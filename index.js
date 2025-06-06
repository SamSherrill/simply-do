const express = require("express");
const AWS = require("aws-sdk");
const app = express();
const port = 3000;

AWS.config.update({
  region: 'us-west-2', // You can choose any dummy region for local
  endpoint: 'http://localhost:8000'
});

AWS.config.credentials = {
  accessKeyId: 'dummyKeyId',
  secretAccessKey: 'dummySecretKey',
};

// Create a DynamoDB DocumentClient, which simplifies working with DynamoDB items
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ddb = new AWS.DynamoDB();

console.log("DynamoDB DocumentClient created"); // You can add this line to verify

const tableName = "todos";

ddb.listTables({}, (err, data) => {
  if (err) {
    console.error("Error listing tables:", err);
  } else if (!data.TableNames.includes(tableName)) {
    console.log(`Table "${tableName}" does not exist. Creating...`);
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: "id", KeyType: "HASH" } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: "id", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    };

    ddb.createTable(params, (err, data) => {
      if (err) {
        console.error("Error creating table:", err);
      } else {
        console.log("Table created successfully:", data);
      }
    });
  } else {
    console.log(`Table "${tableName}" already exists.`);
  }
});

app.get("/", (req, res) => {
  console.log("Root path '/' was accessed!");
  res.send("Hello World!");
});

// Example: Listing DynamoDB tables
ddb.listTables({}, (err, data) => {
  if (err) {
    console.error("Error listing tables:", err);
  } else {
    console.log("List of tables:", data.TableNames);
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});