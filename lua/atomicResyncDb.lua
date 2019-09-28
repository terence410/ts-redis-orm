local clientSchemasString = ARGV[1]
local clientSchemas = cjson.decode(clientSchemasString)
local tableName = ARGV[2]
local createIndexKeys = {}
local deleteIndexKeys = {}
local createUniqueKeys = {}
local deleteUniqueKeys = {}
local batch = 10000

-- find remote schemas and assign index and unique keys
local currRemoteSchemas = remoteSchemas(tableName)

-- prepare all the modified index keys and unique keys
local currPrimaryError = false
for column, clientSchema in pairs(clientSchemas) do
    local remoteSchema = currRemoteSchemas[column]

    if clientSchema.index and (remoteSchema == nil or not remoteSchema.index) then
        table.insert(createIndexKeys, column)
    end

    if clientSchema.unique and (remoteSchema == nil or not remoteSchema.unique) then
        table.insert(createUniqueKeys, column)
    end

    if clientSchema.primary and (remoteSchema == nil or not remoteSchema.primary) then
        currPrimaryError = "Resync db can only apply to same primary keys. The current primary key: " .. column .. " is not the same or not exist in remote schemas";
        break;
    end
end

for column, remoteSchema in pairs(currRemoteSchemas) do
    local clientSchema = clientSchemas[column]

    if remoteSchema.index and (clientSchema == nil or not clientSchema.index) then
        table.insert(deleteIndexKeys, column)
    end

    if remoteSchema.unique and (clientSchema == nil or not clientSchema.unique) then
        table.insert(deleteUniqueKeys, column)
    end

    if remoteSchema.primary and (clientSchema == nil or not clientSchema.primary) then
        currPrimaryError = "Resync can only apply to same primary keys. The remote primary key: " .. column .. " is not the same or not exist in current schemas";
        break;
    end
end

-- return error if primay keys not the same
if currPrimaryError ~= false then
    return error(currPrimaryError)
end

-- start
local createdAtStorageKey = indexStorageKey(tableName, "createdAt")

-- verify if unique keys can be added properly
if #createUniqueKeys > 0 then
    -- remove all existing tables
    for i, uniqueKey in pairs(createUniqueKeys) do
        redis.call("DEL", uniqueStorageKey(tableName, uniqueKey))
    end

    -- add unique keys
    local currUniqueError = false
    for ii, uniqueKey in pairs(createUniqueKeys) do
        -- remove any existing table
        local currUniqueStorageKey = uniqueStorageKey(tableName, uniqueKey)

        -- loop all entity
        local start = 0
        local stop = batch - 1
        local count = 1

        while count > 0 do
            local entityIds = redis.call("ZRANGE", createdAtStorageKey, start, stop)
            count = #entityIds
            start = start + batch
            stop = stop + batch

            for i, entityId in ipairs(entityIds) do
                -- get the value of the column
                local currEntityStorageKey = entityStorageKey(tableName, entityId)
                local value = redis.call("HGET", currEntityStorageKey, uniqueKey)
                if value ~= false then
                    local existEntityId = redis.call("HGET", currUniqueStorageKey, value)
                    if existEntityId ~= false then
                        currUniqueError = "Unique key: " .. uniqueKey .. " with value: " .. value .. " already exist on entity id: " .. existEntityId .. ". Current entity id: " .. entityId
                        break
                    end

                    redis.call("HSET", currUniqueStorageKey, value, entityId)
                end
            end

            -- break while loop with error
            if currUniqueError ~= false then
                break
            end
        end

        -- break all unique keys loop with erro
        if currUniqueError ~= false then
            break
        end
    end

    -- return error
    if currUniqueError ~= false then
        -- clear all created unique tables
        for i, uniqueKey in pairs(createUniqueKeys) do
            redis.call("DEL", uniqueStorageKey(tableName, uniqueKey))
        end

        return error(currUniqueError)
    end
end

-- delete unique tables
if #deleteUniqueKeys > 0 then
    for i, uniqueKey in pairs(deleteUniqueKeys) do
        redis.call("DEL", uniqueStorageKey(tableName, uniqueKey))
    end
end

-- create index tables
if #createIndexKeys > 0 then
    for i, indexKey in pairs(createIndexKeys) do
        redis.call("DEL", indexStorageKey(tableName, indexKey))
    end

    local start = 0
    local stop = batch - 1
    local count = 1

    while count > 0 do
        local entityIds = redis.call("ZRANGE", createdAtStorageKey, start, stop)
        count = #entityIds
        start = start + batch
        stop = stop + batch

        for i, entityId in ipairs(entityIds) do
            local currEntityStorageKey = entityStorageKey(tableName, entityId)

            -- add index keys
            for ii, indexKey in pairs(createIndexKeys) do
                -- remove any existing table
                local currIndexStorageKey = indexStorageKey(tableName, indexKey)
                local value = redis.call("HGET", currEntityStorageKey, indexKey)
                if isnumeric(value) then
                    redis.call("ZADD", currIndexStorageKey, value, entityId)
                end
            end
        end
    end
end

-- delete index tables
if #deleteIndexKeys > 0 then
    for i, indexKey in pairs(deleteIndexKeys) do
        redis.call("DEL", indexStorageKey(tableName, indexKey))
    end
end

-- update schema
local currMetaStorageKey = metaStorageKey(tableName)
redis.call("HSET", currMetaStorageKey, "schemas", clientSchemasString)

local result = {success = true }
return cjson.encode(result)
