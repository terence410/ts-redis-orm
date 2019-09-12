local entityId = ARGV[1]
local isNew = ARGV[2]
local tableName = ARGV[3]
local autoIncrementKey = ARGV[4]
local indexKeys = cjson.decode(ARGV[5])
local uniqueKeys = cjson.decode(ARGV[6])
local changes = cjson.decode(ARGV[7]);
local increments = cjson.decode(ARGV[8]);
local isRestore = ARGV[9]
local result = {entityId = entityId }

-- check if unique exist
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        -- if the changes has set value
        if table.hasKey(changes, uniqueKey) then
            local value = changes[uniqueKey]
            local storedEntityId = redis.call("HGET", uniqueStorageKey(tableName, uniqueKey), value)
            if storedEntityId ~= false and storedEntityId ~= entityId then
                return error("Unique value: " .. value .. " already exist in column: " .. uniqueKey);
            end
        end
    end
end

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
    else
        -- if entity id is larger than the increment Key, we have to update it
        local autoIncrementValue = redis.call("HGET", currMetaStorageKey, hash)
        if tonumber(autoIncrementValue) == nil or tonumber(entityId) > tonumber(autoIncrementValue) then
            redis.call("hset", currMetaStorageKey, hash, tonumber(entityId));
        end
    end
end

-- check if entity id is empty
if isempty(entityId) then
    return error("Invalid Entity Id");
end

-- entity key
local currEntityStorageKey = entityStorageKey(tableName, entityId)

local exist = redis.call("EXISTS", currEntityStorageKey)
if isNew == "true" then
    -- check model exist for new
    if exist == 1 then
        return error("Duplicated enity id: " .. entityId);
    end
else
    -- make sure model exist
    if exist ~= 1 then
        return error("Entity not exist: " .. entityId);
    end
end

-- process increments first
for column, value in pairs( increments ) do
    -- make sure it's not unique key
    if not table.hasValue(uniqueKeys, column) then
        local updatedValue = redis.call("HINCRBY", currEntityStorageKey, column, value)
        result["increments"] = {}
        result["increments"][column] = updatedValue

        -- override changes
        changes[column] = updatedValue
    end
end

-- create all the index if it's set in the changes, unset if the value is not number
if #indexKeys > 0 then
    for i, indexKey in pairs( indexKeys ) do
        -- if the changes has set value
        if table.hasKey(changes, indexKey) then
            local value = changes[indexKey]
            if tonumber(value) ~= nil then
                redis.call("ZADD", indexStorageKey(tableName, indexKey), value, entityId)
            else
                redis.call("ZREM", indexStorageKey(tableName, indexKey), entityId)
            end
        end
    end
end

-- create all unique if it's exist in the changes, remove the old unique key if needed
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs( uniqueKeys ) do
        -- if the changes has set value
        if table.hasKey(changes, uniqueKey) then
            local value = changes[uniqueKey]
            local currUniqueKeyValue = redis.call("HGET", currEntityStorageKey, uniqueKey)

            -- remove the old unique key since they are different
            if currUniqueKeyValue ~= false and currUniqueKeyValue ~= value then
                redis.call("HDEL", uniqueStorageKey(tableName, uniqueKey), currUniqueKeyValue)
            end

            -- save the new unique key
            redis.call("HSET", uniqueStorageKey(tableName, uniqueKey), value, entityId)
        end
    end
end

-- if it's restore, restore all index
if isRestore == "true" then
    if #indexKeys > 0 then
        for i, indexKey in pairs( indexKeys ) do
            local value = redis.call("HGET", currEntityStorageKey, indexKey);
            if tonumber(value) ~= nil then
                redis.call("ZADD", indexStorageKey(tableName, indexKey), value, entityId)
            end
        end
    end

    -- remove deletedAt
    redis.call("ZREM", indexStorageKey(tableName, "deletedAt"), entityId)
end

-- save model
redis.call("HMSET", currEntityStorageKey, unpack(table.flattern(changes)))

return cjson.encode(result)
