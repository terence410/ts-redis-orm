local tableName = ARGV[1]
local indexKeys = {}
local uniqueKeys = {}
local batch = 10000

-- find remote schemas and assign index and unique keys
local currRemoteSchemas = getRemoteSchemas(tableName)
for i, schema in pairs(currRemoteSchemas) do
    if schema.index then
        table.insert(indexKeys, i)
    end

    if schema.unique then
        table.insert(uniqueKeys, i)
    end
end

-- remove all entities found in createdAt index
local count = 1
local createdAtStorageKey = getIndexStorageKey(tableName, "createdAt")
while count > 0 do
    local entityIds = redis.call("ZRANGE", createdAtStorageKey, 0, batch)
    count = #entityIds

    for i, entityId in pairs(entityIds) do
        redis.call("ZREM", getIndexStorageKey(tableName, "createdAt"), entityId)
        local currEntityStorageKey = getEntityStorageKey(tableName, entityId)
        redis.call("DEL", currEntityStorageKey)
    end
end

-- remove all entities found in deletedAt index
count = 1
local deletedAtStorageKey = getIndexStorageKey(tableName, "deletedAt")
while count > 0 do
    local entityIds = redis.call("ZRANGE", deletedAtStorageKey, 0, batch)
    count = #entityIds

    for i, entityId in pairs(entityIds) do
        redis.call("ZREM", getIndexStorageKey(tableName, "deletedAt"), entityId)
        local currEntityStorageKey = getEntityStorageKey(tableName, entityId)
        redis.call("DEL", currEntityStorageKey)
    end
end

-- remove all index keys
if #indexKeys > 0 then
    for i, indexKey in pairs( indexKeys ) do
         redis.call("DEL", getIndexStorageKey(tableName, indexKey))
    end
end

-- remove all unique keys
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        redis.call("DEL", getUniqueStorageKey(tableName, uniqueKey))
    end
end

-- remove meta
redis.call("HDEL", getAutoIncrementStorageKey(), tableName);

-- remove meta
redis.call("HDEL", getSchemasStorageKey(), tableName);
