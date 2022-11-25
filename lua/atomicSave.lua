local clientSchemasString = ARGV[1]
local entityId = ARGV[2]
local isNew = ARGV[3]
local tableName = ARGV[4]
local autoIncrementKey = ARGV[5]
local indexKeys = cjson.decode(ARGV[6])
local uniqueKeys = cjson.decode(ARGV[7])
local changes = cjson.decode(ARGV[8])
local increments = cjson.decode(ARGV[9])
local result = {entityId = entityId }

-- verify schemas
local isVerified = verifySchemas(tableName, clientSchemasString)
if not isVerified then
    return error("Mismatch with remote Schemas")
end

-- entity key
local currEntityStorageKey = getEntityStorageKey(tableName, entityId)

-- check if unique exist
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        if table_hasKey(changes, uniqueKey) then
            -- if the changes has set value
            local newValue = changes[uniqueKey]
            local existEntityId = redis.call("HGET", getUniqueStorageKey(tableName, uniqueKey), newValue)
            if existEntityId ~= false then
                local message = "Unique key \"" .. uniqueKey .. "\" with value \"" .. newValue .. "\" already exist on entity id \"" .. existEntityId .. "\""
                return error(message)
            end
        end
    end
end

if isNew == "true" then
    -- generate auto increment entityId for new model
    if isnotempty(autoIncrementKey) then
        local hash = tableName
        local autoIncrementStorageKey = getAutoIncrementStorageKey()
        local autoIncrementValue = redis.call("HGET", autoIncrementStorageKey, hash)

        -- set a default to 0 for auto increment
        if autoIncrementValue == false then
            autoIncrementValue = "0"
            redis.call("HSET", autoIncrementStorageKey, hash, autoIncrementValue)
        end

        if isempty(entityId) or tonumber(entityId) == 0 then
            autoIncrementValue = redis.call("HINCRBY", autoIncrementStorageKey, hash, 1)
            entityId = tostring(autoIncrementValue)
            changes[autoIncrementKey] = entityId
            result["entityId"] = entityId
            result["autoIncrementKeyValue"] = autoIncrementValue

            -- update the storage key
            currEntityStorageKey = getEntityStorageKey(tableName, entityId)

        elseif not isnumeric(entityId) then
            -- entityId is not empty, but also not a number
            return error("Entity Id \"" .. entityId .. "\" is not a number for auto increment column")
        else
            -- if entity id is larger than the increment Key, we have to update it
            if tonumber(entityId) > tonumber(autoIncrementValue) then
                redis.call("HSET", autoIncrementStorageKey, hash, entityId)
            end
        end
    end

    -- make sure we have entity id for new entity
    if isempty(entityId) then
        return error("Entity Id is empty")
    end

    -- check if there is existing model
    local exist = redis.call("EXISTS", currEntityStorageKey)
    if exist == 1 then
        return error("Duplicated enity. Entity Id \"" .. entityId .. "\"")
    end
else
    -- make sure model exist and not deleted
    local existId = redis.call("HGET", currEntityStorageKey, "id")
    if existId == false then
        return error("Entity not exist. Entity Id \"" .. entityId .. "\"")
    end
end

-- process increments first
for column, value in pairs(increments) do
    -- make sure it's not unique key
    if not table_hasValue(uniqueKeys, column) then
        local newValue = redis.call("HINCRBY", currEntityStorageKey, column, value)
        result["increments"] = {}
        result["increments"][column] = newValue

        -- override changes
        changes[column] = newValue
    end
end

-- create all the index if it's set in the changes, unset if the value is not number
if #indexKeys > 0 then
    for i, indexKey in pairs(indexKeys) do
        -- if the changes has set value
        if table_hasKey(changes, indexKey) then
            local newValue = changes[indexKey]
            if isnumeric(newValue) then
                redis.call("ZADD", getIndexStorageKey(tableName, indexKey), newValue, entityId)
            else
                redis.call("ZREM", getIndexStorageKey(tableName, indexKey), entityId)
            end
        end
    end
end

-- create all unique if it's exist in the changes, remove the old unique key if needed
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        -- if the changes has set value
        if table_hasKey(changes, uniqueKey) then
            local newValue = changes[uniqueKey]
            local value = redis.call("HGET", currEntityStorageKey, uniqueKey)

            -- remove the old unique key since they are different
            if value ~= false and value ~= newValue then
                redis.call("HDEL", getUniqueStorageKey(tableName, uniqueKey), value)
            end

            -- save the new unique key
            redis.call("HSET", getUniqueStorageKey(tableName, uniqueKey), newValue, entityId)
        end
    end
end

-- save all values
redis.call("HMSET", currEntityStorageKey, unpack(table_flattern(changes)))

-- send result
return cjson.encode(result)
