local clientSchemasString = ARGV[1]
local entityId = ARGV[2]
local tableName = ARGV[3]
local indexKeys = cjson.decode(ARGV[4])
local uniqueKeys = cjson.decode(ARGV[5])
local result = { entityId = entityId }

-- verify schemas
local isVerified = verifySchemas(tableName, clientSchemasString)
if not isVerified then
    return error("Mismatch with remote Schemas")
end

-- entity id key
local currEntityStorageKey = getEntityStorageKey(tableName, entityId)

-- check entity exist and the state
local existId = redis.call("HGET", currEntityStorageKey, "id")
if existId == false then
    return error("Entity not exist. Entity Id \"" .. entityId .. "\"")
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

-- remove the entity
redis.call("DEL", currEntityStorageKey)

return cjson.encode(result)
