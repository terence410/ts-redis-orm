local clientSchemasString = ARGV[1]
local entityId = ARGV[2]
local isSoftDelete = ARGV[3]
local tableName = ARGV[4]
local deletedAtTimestamp = ARGV[5]
local indexKeys = cjson.decode(ARGV[6])
local uniqueKeys = cjson.decode(ARGV[7])
local result = { entityId = entityId }

-- verify schemas
local isVerified = verifySchemas(tableName, clientSchemasString)
if not isVerified then
    return error("Invalid Schemas")
end

-- entity id key
local currEntityStorageKey = getEntityStorageKey(tableName, entityId)

-- check entity exist and the state
local deletedAt = redis.call("HGET", currEntityStorageKey, "deletedAt")
if deletedAt == false then
    return error("Entity not exist. Entity Id: " .. entityId)
elseif deletedAt ~= "NaN" and isSoftDelete == "true" then
    return error("Entity already deleted. Entity Id: " .. entityId)
end

-- remove all indexes
if #indexKeys > 0 then
    for i, indexKey in pairs(indexKeys) do
        redis.call("ZREM", getIndexStorageKey(tableName, indexKey), entityId)
    end
end

-- remove all unqiueKeys
if #uniqueKeys > 0 then
    for i, uniqueKey in pairs(uniqueKeys) do
        -- if the attributes has set value
        local currUniqueKeyValue = redis.call("HGET", currEntityStorageKey, uniqueKey)

        -- remove the old unique key since they are different
        if currUniqueKeyValue ~= false then
            redis.call("HDEL", getUniqueStorageKey(tableName, uniqueKey), currUniqueKeyValue)
        end
    end
end

-- if it is softDelete
if isSoftDelete == "true" then
    -- add deletedAt index
    redis.call("ZADD", getIndexStorageKey(tableName, "deletedAt"), deletedAtTimestamp, entityId)

    -- add deletedAt into Model
    redis.call("HSET", currEntityStorageKey, "deletedAt", deletedAtTimestamp)
else
    -- remove deletedAt index
    redis.call("ZREM", getIndexStorageKey(tableName, "deletedAt"), entityId)

    -- remove the entity
    redis.call("DEL", currEntityStorageKey)
end

return cjson.encode(result)
