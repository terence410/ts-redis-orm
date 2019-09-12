local tableName = ARGV[1];
local column = ARGV[2];
local total = 0

redis.call("DEL", indexStorageKey(tableName, column))
local ids = redis.call("ZRANGE", indexStorageKey(tableName, "createdAt"), 0, -1)
for i, id in ipairs(ids) do
    local attribute = redis.call("HGET", entityStorageKey(tableName, id), column)
    if attribute ~= false and tonumber(attribute) ~= nil then
        redis.call("ZADD", indexStorageKey(tableName, column), attribute, id)
        total = total + 1
    end
end

return total
