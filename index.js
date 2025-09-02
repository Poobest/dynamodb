// index.js
require("dotenv").config();
const express = require("express");
const { ddbClient } = require("./ddb-client");
const { QueryCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE = process.env.DDB_TABLE;

function toAV(value, typeHint) {
  const t = typeHint ? String(typeHint).toUpperCase() : "S";
  if (t === "N") return { N: String(value) };
  if (t === "BOOL")
    return { BOOL: value === true || String(value).toLowerCase() === "true" };
  if (t === "NULL") return { NULL: true };
  return { S: String(value) }; // default เป็น String
}

app.get("/api/process/:onlTxId", async (req, res) => {
  const onlTxId = req.params.onlTxId;
  const limit = Number(req.query.limit) || 50;
  const nextKey = req.query.nextKey ? JSON.parse(req.query.nextKey) : undefined;

  try {
    let resp;

    resp = await ddbClient.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "onlTxId = :tx",
        ExpressionAttributeValues: { ":tx": { S: onlTxId } },
        Limit: limit,
        ExclusiveStartKey: nextKey,
      })
    );

    const items = (resp.Items || []).map(unmarshall);
    res.json({
      items,
      count: resp.Count ?? items.length,
      scanned: resp.ScannedCount,
      lastKey: resp.LastEvaluatedKey
        ? JSON.stringify(resp.LastEvaluatedKey)
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.name, message: err.message });
  }
});

app.get("/api/:table", async (req, res) => {
  const table = req.params.table;
  const { key, value, type, limit, nextKey } = req.query;

  if (!table || !key || value === undefined) {
    return res
      .status(400)
      .json({ error: "BadRequest", message: "ต้องระบุ table, key, value" });
  }

  try {
    const input = {
      TableName: table,
      // onlTxId รับจาก key → map เป็น #attr
      FilterExpression: "#attr = :tx",
      ExpressionAttributeNames: { "#attr": String(key) },
      // :tx รับจาก value (แปลงชนิดตาม type)
      ExpressionAttributeValues: { ":tx": toAV(value, type) },
      Limit: Number(limit) || 50,
      ExclusiveStartKey: nextKey ? JSON.parse(nextKey) : undefined,
    };

    const resp = await ddbClient.send(new ScanCommand(input));
    const items = (resp.Items || []).map(unmarshall);

    res.json({
      mode: "scan",
      items,
      count: resp.Count ?? items.length,
      scanned: resp.ScannedCount,
      lastKey: resp.LastEvaluatedKey
        ? JSON.stringify(resp.LastEvaluatedKey)
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.name, message: err.message });
  }
});

app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
