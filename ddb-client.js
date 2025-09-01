require("dotenv").config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  // ถ้ารันกับ DynamoDB Local:
  // endpoint: "http://localhost:8000",
  // credentials: { accessKeyId: "dummy", secretAccessKey: "dummy" }
});

module.exports = { ddbClient };
