// index.js
require("dotenv").config();
const express = require("express");
const { ddbClient } = require("./ddb-client");
const { QueryCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE = process.env.DDB_TABLE;
const INDEX = process.env.GSI_ONLTXID; // ชื่อ GSI (ถ้ามี)

app.get("/api/process/:onlTxId", async (req, res) => {
  const onlTxId = req.params.onlTxId;
  const limit = Number(req.query.limit) || 50;
  const nextKey = req.query.nextKey ? JSON.parse(req.query.nextKey) : undefined;

  try {
    let resp;
    if (INDEX) {
      // ทางที่แนะนำ: มี GSI บน onlTxId
      resp = await ddbClient.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: INDEX,
          KeyConditionExpression: "onlTxId = :tx",
          ExpressionAttributeValues: { ":tx": { S: onlTxId } },
          Limit: limit,
          ExclusiveStartKey: nextKey,
        })
      );
    } else {
      // ชั่วคราว: ไม่มี GSI → Scan + Filter (ช้า ไม่เหมาะกับโปรดักชัน/ข้อมูลเยอะ)
      resp = await ddbClient.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: "onlTxId = :tx",
          ExpressionAttributeValues: { ":tx": { S: onlTxId } },
          Limit: limit,
          ExclusiveStartKey: nextKey,
        })
      );
    }

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

app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
