-- debug purpose
--redis.pcall("del", "debug")
local function logit(msg)
    redis.pcall("RPUSH", "debug", msg)
end

local function error(errorMessage)
    local respond = {}
    respond["error"] = errorMessage
    return cjson.encode(respond)
end

local function entityStorageKey(tableName, id)
    return "entity:" .. tableName .. ":" .. id
end

local function indexStorageKey(tableName, column)
    return "index:" .. tableName .. ":" .. column
end

local function uniqueStorageKey(tableName, column)
    return "unique:" .. tableName .. ":" .. column
end

local function metaStorageKey(tableName)
    return "meta:" .. tableName
end

local function tempStorageKey(tableName, column)
    return "temp:" .. tableName .. ":" .. column
end

local function isempty(s)
    return s == nil or s == ""
end

local function isnotempty(s)
    return s ~= nil and s ~= ""
end

function table.check(indexArr)
    for i, val in pairs( indexArr ) do
        logit(tostring(i) .. ": (" .. type(val) .. ") " .. val);
    end
end

function table.hasKey(dict, key)
    for _key, value in pairs(dict) do
        if _key == key then
            return true
        end
    end
    return false
end

function table.hasValue(array, value)
    for i, _value in ipairs(array) do
        if _value == value then
            return true
        end
    end
    return false
end

function table.slice(arr, first, last)
    local sliced = {}
    for i = first or 1, last or #arr, 1 do
        sliced[#sliced + 1] = arr[i]
    end
    return sliced
end

function table.values( tbl )
    local arr = {}
    for key, val in pairs( tbl ) do
        arr[ #arr + 1 ] = val
    end
    return arr
end

function table.flattern(dict)
    local tbl = {}
    for k, v in pairs(dict) do
        table.insert(tbl, k)
        table.insert(tbl, v)
    end
    return tbl
end


function table.keys( tbl )
    local arr = {}
    for key, val in pairs( tbl ) do
        arr[ #arr + 1 ] = key
    end
    return arr
end

function table.toTable(arr)
    local tbl = {}
    for i, val in ipairs(arr) do
        tbl[val] = 1
    end
    return tbl
end

function table.whereIndexIntersect(indexArr, tbls)
    if #tbls < 1 then return indexArr end

    local tblParis = ipairs(tbls)
    for i, v in pairs(indexArr) do
        for ii, _ in ipairs(tbls) do
            if tbls[ii][v] == nil then
                indexArr[i] = nil
            end
        end
    end

    -- this indexArr will become non iterable table, convert it back to array
    return table.values(indexArr)
end

