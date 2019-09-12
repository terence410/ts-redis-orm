local formatFn = {
  ["%Y"] = function(self) return self["y"] end,
  ["%y"] = function(self) return string.format("%.2d", self["y"] % 100) end,
  ["%m"] = function(self) return string.format("%.2d", self["m"]) end,
  ["%d"] = function(self) return string.format("%.2d", self["d"]) end,
  ["%h"] = function(self) return string.format("%.2d", self["h"]) end,
  ["%i"] = function(self) return string.format("%.2d", self["i"]) end,
  ["%s"] = function(self) return string.format("%.2d", self["s"]) end
};

local function dateFormat(time, format)
  time = tonumber(time)
  if time ~= nil and time >= 0 then
    local dates = {}
    time = time / 1000;
    dates["s"] = math.floor(time % 60)
    time = time / 60;
    dates["i"] = math.floor(time % 60)
    time = time / 60;
    dates["h"] = math.floor(time % 24)
    time = time / 24
    
    local a = math.floor((4 * time + 102032) / 146097 + 15)
    local b = math.floor(time + 2442113 + a - math.floor(a / 4))
    local c = math.floor((20 * b - 2442) / 7305)
    local d = math.floor(b - 365 * c - math.floor(c / 4))
    local e = math.floor(d * 1000 / 30601)
    local f = math.floor(d - e * 30 - math.floor(e * 601 / 1000))
 
    if e <= 13 then
       c = c - 4716
       e = e - 1
    else
       c = c - 4715
       e = e - 13
    end
    
    dates["y"] = c;
    dates["m"] = e;
    dates["d"] = f;
    
    local result = string.gsub(format, "%%[%a%%\\b\\f]", function(x) local f = formatFn[x]; return (f and f(dates) or x) end)
    return result
  end
  
  return ""
end

local function aggregateData(ids, namespace, aggregate, aggregateColumn, groupByColumn, groupByDateFormat)
  local result = {}
  local total = {}
  
  for i, id in ipairs(ids) do
    local currEntityStorageKey = entityStorageKey(namespace, id)
    local aggregateValue = false
    local groupByValue = "*"
    
    -- only non count aggregate need the count value
    if aggregate ~= "count" then
      aggregateValue = redis.call("HGET", currEntityStorageKey, aggregateColumn)
    end
    
    -- try to get the group by value
    if isnotempty(groupByColumn) then
      if groupByColumn == aggregateColumn then
        groupByValue = aggregateValue
      else
        groupByValue = redis.call("HGET", currEntityStorageKey, groupByColumn)
      end
      
      if groupByValue == false then 
        groupByValue = ""
      elseif groupByDateFormat ~= "" then
        groupByValue = dateFormat(groupByValue, groupByDateFormat)
      end
    end
    
    -- convert the value 
    aggregateValue = tonumber(aggregateValue)
    if aggregate == "count" then
      if result[groupByValue] then
        result[groupByValue] = result[groupByValue] + 1
      else 
        result[groupByValue] = 1
      end
      
    -- the rest of the aggregate must need a valid aggregate value
    elseif aggregateValue ~= nil then
      if aggregate == "min" then
        if result[groupByValue] ~= nil then
          result[groupByValue] = math.min(result[groupByValue], aggregateValue)
        else 
          result[groupByValue] = aggregateValue
        end
        
      elseif aggregate == "max" then
        if result[groupByValue] ~= nil then
          result[groupByValue] = math.max(result[groupByValue], aggregateValue)
        else 
          result[groupByValue] = aggregateValue
        end
        
      elseif aggregate == "sum" then
        if result[groupByValue] ~= nil then
          result[groupByValue] = result[groupByValue] + aggregateValue
        else 
          result[groupByValue] = aggregateValue
        end
        
      elseif aggregate == "avg" then
        if result[groupByValue] ~= nil then
          result[groupByValue] = result[groupByValue] + aggregateValue
          total[groupByValue] = total[groupByValue] + 1
        else 
          result[groupByValue] = aggregateValue
          total[groupByValue] = 1
        end
          
      end
    end
  end
  
  -- do operation on avg
  if aggregate == "avg" then
    for key, value in pairs(result) do
      result[key] = result[key] / total[key]
    end
  end
  
  return result
end

local function finalOrderBy(ids, tableName, column, order, offset, limit)
  local currTempStorageKey = tempStorageKey(tableName, column)

  -- remove temp table (if exist for some reason)
  redis.call("DEL", currTempStorageKey);

  -- add value into temp table
  for i, id in ipairs(ids) do
    local currEntityStorageKey = entityStorageKey(tableName, id)
    local columnValue = redis.call("HGET", currEntityStorageKey, column)

    if tonumber(columnValue) == nil then
        columnValue = "-inf";
    end

    redis.call("ZADD", currTempStorageKey, columnValue, id)
  end

  -- do sorting
  local tempIds = {}
  local min = "-inf"
  local max = "+inf"

  if order == "asc" then
    tempIds = redis.call("ZRANGEBYSCORE", currTempStorageKey, min, max, "LIMIT", offset, limit)
  else
    tempIds = redis.call("ZREVRANGEBYSCORE", currTempStorageKey, max, min, "LIMIT", offset, limit)
  end

  -- remove temp table
  redis.call("DEL", currTempStorageKey);

  return tempIds
end

local function whereSearch(ids, namespace, whereArgvs)
  local newIds = {}
  
  for i, id in ipairs(ids) do
    local condition = true
    for ii, whereArgv in ipairs(whereArgvs) do
      local currEntityStorageKey = entityStorageKey(namespace, id)
      local attributeValue = redis.call("HGET", currEntityStorageKey, whereArgv["column"])

      if attributeValue == false then
        -- if we do not have the value, then it depends on the operator
        if whereArgv["operator"] == "=" then
          condition = false
          break
        elseif whereArgv["operator"] == "like" then
          condition = false
          break
        elseif whereArgv["operator"] == "!=" then
          condition = true
          break
        end
      else
        if whereArgv["operator"] == "=" and (attributeValue ~= whereArgv["searchValue"]) then
          condition = false
          break
        elseif whereArgv["operator"] == "like" and (not string.find(attributeValue, whereArgv["searchValue"]))  then
          condition = false
          break
        elseif whereArgv["operator"] == "!=" and attributeValue == whereArgv["searchValue"] then
          condition = false
          break
        end
      end
    end
    
    if condition then
      table.insert(newIds, id)
    end
  end
  
  return newIds
end

-- keys
local indexCount = ARGV[1];
local whereCount = ARGV[2];
local offset = tonumber(ARGV[3]);
local limit = tonumber(ARGV[4]);
local tableName = ARGV[5];
local aggregate = ARGV[6];
local aggregateColumn = ARGV[7];
local groupByColumn = ARGV[8];
local groupByDateFormat = ARGV[9];
local finalSortByColumn = ARGV[10];
local finalSortByOrder = ARGV[11];

-- find the ids of the intersection of the indexes
local indexArr = {}
local indexTbls = {}
local index = 12;

-- we only able to do sorting for the first where cause
local firstTable = true
for i = index, index + indexCount * 3 - 1, 3 do
  -- increment for latter use
  index = index + 3
  local column = ARGV[i]
  local min = ARGV[i + 1]
  local max = ARGV[i + 2]

  local indexStorageKey = indexStorageKey(tableName, column)

  -- we do checking for the first sorted set only
  if firstTable then
    firstTable = false
    local order = "asc"

    -- override the order
    if column == finalSortByColumn then
      order = finalSortByOrder
      -- we reset the final order
      finalSortByColumn = ""
      finalSortByOrder = ""
    end

    if order == "asc" then
      indexArr = redis.call("ZRANGEBYSCORE", indexStorageKey, min, max)
    else
      indexArr = redis.call("ZREVRANGEBYSCORE", indexStorageKey, max, min)
    end

  else
    local ids = redis.call("ZREVRANGEBYSCORE", indexStorageKey, max, min)
    indexTbls[#indexTbls + 1] = table.toTable(ids)
  end
end

-- find out all intersect id
local ids = table.whereIndexIntersect(indexArr, indexTbls)

-- do where search if needed
if tonumber(whereCount) > 0 then
  local whereArgvs = {}

  for i = index, index + whereCount * 3 - 1, 3 do
    local whereArgv = {}
    whereArgv["column"] = ARGV[i]
    whereArgv["operator"] = ARGV[i + 1]
    whereArgv["searchValue"] = ARGV[i + 2]
    whereArgvs[#whereArgvs + 1] = whereArgv
  end

  ids = whereSearch(ids, tableName, whereArgvs)
end

-- do aggreate
if isnotempty(aggregate) then
  local result = {}
  if aggregate == "count" and isempty(groupByColumn) then
    result["*"] = #ids
  else
    result = aggregateData(ids, tableName, aggregate, aggregateColumn, groupByColumn, groupByDateFormat)
  end
  return cjson.encode(result)

else
  if isnotempty(finalSortByColumn) and isnotempty(finalSortByOrder) then
    --  do a final ordering
    ids = finalOrderBy(ids, tableName, finalSortByColumn, finalSortByOrder, offset, limit)
  elseif offset ~= 0 or limit ~= -1 then
    --  offset and limit
    -- the index starts at 1, but if you use 0, 2, it can also get the first 2 records
    ids = table.slice(ids, 1 + offset, limit == -1 and #ids or offset + limit)
  end
end

return ids
