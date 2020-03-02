local tableName = ARGV[1]
local indexKeys = {}
local uniqueKeys = {}
local batch = 10000
local total = 0

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
    total = total + count;

    for i, entityId in pairs(entityIds) do
        redis.call("ZREM", getIndexStorageKey(tableName, "createdAt"), entityId)
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

local result = { total = total }
return cjson.encode(result)
