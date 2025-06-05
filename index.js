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