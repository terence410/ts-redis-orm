local entityId = ARGV[1]
local isSoftDelete = ARGV[2]
local tableName = ARGV[3]
local deletedAtTimestamp = ARGV[4]
local indexKeys = cjson.decode(ARGV[5])
local uniqueKeys = cjson.decode(ARGV[6])
local result = { entityId = entityId }

-- entity id key
local currEntityStorageKey = entityStorageKey(tableName, entityId)

-- make sure model exist
local exist = redis.call("EXISTS", currEntityStorageKey)
if exist ~= 1 then
    return error("Entity not exist: " .. entityId);
end

-- remove all indexes
if #indexKeys > 0 then
    for i, indexKey in pairs( indexKeys ) do
        redis.call("ZREM", indexStorageKey(tableName, indexKey), entityId)
    end
end

-- if it is softDelete
if isSoftDelete == "true" then
    -- add deletedAt index
    redis.call("ZADD", indexStorageKey(tableName, "deletedAt"), deletedAtTimestamp, entityId)

    -- add deletedAt into Model
    redis.call("HSET", currEntityStorageKey, "deletedAt", deletedAtTimestamp)
else
    -- remove deletedAt index
    redis.call("ZREM", indexStorageKey(tableName, "deletedAt"), entityId)

    -- remove all unqiueKeys
    if #uniqueKeys > 0 then
        for i, uniqueKey in pairs( uniqueKeys ) do
            -- if the attributes has set value
            local currUniqueKeyValue = redis.call("HGET", currEntityStorageKey, uniqueKey)

            -- remove the old unique key since they are different
            if currUniqueKeyValue ~= false then
                redis.call("HDEL", uniqueStorageKey(tableName, uniqueKey), currUniqueKeyValue)
            end
        end
    end

    -- remove the entity
    redis.call("DEL", currEntityStorageKey);
end

return cjson.encode(result)
