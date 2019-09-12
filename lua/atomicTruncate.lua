local tableName = ARGV[1]
local indexKeys = cjson.decode(ARGV[2])
local uniqueKeys = cjson.decode(ARGV[3])
local batch = 10000;

-- remove all entities found in createdAt index
local count = 1;
local createdAtStorageKey = indexStorageKey(tableName, "createdAt");
while count > 0 do
    local indexArr = redis.call("ZRANGE", createdAtStorageKey, 0, batch)
    count = #indexArr

    for i, id in pairs(indexArr) do
        redis.call("ZREM", indexStorageKey(tableName, "createdAt"), id)
        local currEntityStorageKey = entityStorageKey(tableName, id)
        redis.call("DEL", currEntityStorageKey);
    end
end

-- remove all entities found in deletedAt index
count = 1
local deletedAtStorageKey = indexStorageKey(tableName, "deletedAt");
while count > 0 do
    local indexArr = redis.call("ZRANGE", deletedAtStorageKey, 0, batch)
    count = #indexArr

    for i, id in pairs(indexArr) do
        redis.call("ZREM", indexStorageKey(tableName, "deletedAt"), id)
        local currEntityStorageKey = entityStorageKey(tableName, id)
        redis.call("DEL", currEntityStorageKey);
    end
end

-- remove all index keys
if #indexKeys > 0 then
    for i, indexKey in pairs( indexKeys ) do
         redis.call("DEL", indexStorageKey(tableName, indexKey))
    end
end

-- remove all unique keys
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        redis.call("DEL", uniqueStorageKey(tableName, uniqueKey))
    end
end

-- remove meta
redis.call("HDEL", metaStorageKey(tableName), "autoIncrement")
