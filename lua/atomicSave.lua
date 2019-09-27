local clientSchemasString = ARGV[1]
local entityId = ARGV[2]
local isNew = ARGV[3]
local tableName = ARGV[4]
local autoIncrementKey = ARGV[5]
local indexKeys = cjson.decode(ARGV[6])
local uniqueKeys = cjson.decode(ARGV[7])
local changes = cjson.decode(ARGV[8])
local increments = cjson.decode(ARGV[9])
local isRestore = ARGV[10]
local result = {entityId = entityId }

-- verify schemas
local isVerified = verifySchemas(tableName, clientSchemasString);
if not isVerified then
    return error("Invalid Schemas")
end

-- entity key
local currEntityStorageKey = entityStorageKey(tableName, entityId)

-- check if unique exist
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        if table.hasKey(changes, uniqueKey) then
            -- if the changes has set value
            local newValue = changes[uniqueKey]
            local existEntityId = redis.call("HGET", uniqueStorageKey(tableName, uniqueKey), newValue)
            if existEntityId ~= false then
                local message = "Unique key: " .. uniqueKey .. " with value: " .. value .. " already exist on entity id: " .. existEntityId .. ". Current entity id: " .. entityId
                return error(message)
            end
        end
    end
end

if isRestore == "true" then
    -- check entity exist or not based on isNew
    local exist = redis.call("EXISTS", currEntityStorageKey)
    -- make sure model exist
    if exist ~= 1 then
        return error("Entity not exist. Entity Id: " .. entityId)
    end

    -- check all unique keys
    if #uniqueKeys > 0 then
        for i, uniqueKey in pairs(uniqueKeys) do
            if not table.hasKey(changes, uniqueKey) then
                local value = redis.call("HGET", currEntityStorageKey, uniqueKey)
                if value ~= false then
                    local existEntityId = redis.call("HGET", uniqueStorageKey(tableName, uniqueKey), value)
                    if existEntityId ~= false then
                        local message = "Unique key: " .. uniqueKey .. " with value: " .. value .. " already exist on entity id: " .. existEntityId .. ". Current entity id: " .. entityId
                        return error(message)
                    end
                end
            end
        end
    end

    -- restore all unique
    if #uniqueKeys > 0 then
        for i, uniqueKey in pairs(uniqueKeys) do
            local value = redis.call("HGET", currEntityStorageKey, uniqueKey)
            if value ~= false then
                redis.call("HSET", uniqueStorageKey(tableName, uniqueKey), value, entityId)
            end
        end
    end

    -- restore all index
    if #indexKeys > 0 then
        for i, indexKey in pairs(indexKeys) do
            local value = redis.call("HGET", currEntityStorageKey, indexKey)
            if tonumber(value) ~= nil then
                redis.call("ZADD", indexStorageKey(tableName, indexKey), value, entityId)
            end
        end
    end

    -- remove deletedAt
    redis.call("ZREM", indexStorageKey(tableName, "deletedAt"), entityId)
else
    -- generate auto increment entityId for new model
    if isnotempty(autoIncrementKey) and isNew == "true" then
        local hash = "autoIncrement";
        local currMetaStorageKey = metaStorageKey(tableName)

        if isempty(entityId) or tonumber(entityId) == 0 then
            local autoIncrementKeyValue = redis.call("hincrby", currMetaStorageKey, hash, 1);
            entityId = tostring(autoIncrementKeyValue)
            changes[autoIncrementKey] = entityId
            result["entityId"] = entityId
            result["autoIncrementKeyValue"] = autoIncrementKeyValue

            -- update the storage key
            currEntityStorageKey = entityStorageKey(tableName, entityId)
        else
            -- if entity id is larger than the increment Key, we have to update it
            local autoIncrementValue = redis.call("HGET", currMetaStorageKey, hash)
            if tonumber(autoIncrementValue) == nil or tonumber(entityId) > tonumber(autoIncrementValue) then
                redis.call("hset", currMetaStorageKey, hash, tonumber(entityId))
            end
        end
    end

    -- check entity exist or not based on isNew
    local exist = redis.call("EXISTS", currEntityStorageKey)
    if isNew == "true" then
        -- check if entity id is empty
        if isempty(entityId) then
            return error("Invalid Entity Id")
        end

        -- check model exist for new
        if exist == 1 then
            return error("Duplicated enity. Entity Id: " .. entityId)
        end
    else
        -- make sure model exist
        if exist ~= 1 then
            return error("Entity not exist. Entity Id: " .. entityId)
        end
    end
end

-- process increments first
for column, value in pairs(increments) do
    -- make sure it's not unique key
    if not table.hasValue(uniqueKeys, column) then
        local newValue = redis.call("HINCRBY", currEntityStorageKey, column, value)
        result["increments"] = {}
        result["increments"][column] = newValue

        -- override changes
        changes[column] = newValue
    end
end

-- create all the index if it's set in the changes, unset if the value is not number
if #indexKeys > 0 then
    for i, indexKey in pairs( indexKeys ) do
        -- if the changes has set value
        if table.hasKey(changes, indexKey) then
            local newValue = changes[indexKey]
            if tonumber(newValue) ~= nil then
                redis.call("ZADD", indexStorageKey(tableName, indexKey), newValue, entityId)
            else
                redis.call("ZREM", indexStorageKey(tableName, indexKey), entityId)
            end
        end
    end
end

-- create all unique if it's exist in the changes, remove the old unique key if needed
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        -- if the changes has set value
        if table.hasKey(changes, uniqueKey) then
            local newValue = changes[uniqueKey]
            local value = redis.call("HGET", currEntityStorageKey, uniqueKey)

            -- remove the old unique key since they are different
            if value ~= false and value ~= newValue then
                redis.call("HDEL", uniqueStorageKey(tableName, uniqueKey), value)
            end

            -- save the new unique key
            redis.call("HSET", uniqueStorageKey(tableName, uniqueKey), newValue, entityId)
        end
    end
end

-- save all values
redis.call("HMSET", currEntityStorageKey, unpack(table.flattern(changes)))

-- send result
return cjson.encode(result)
