const express = require("express");
const AWS = require("aws-sdk");
const app = express();
const port = 3000;

AWS.config.update({
  region: "us-west-2", // You can choose any dummy region for local
  endpoint: "http://localhost:8000",
});

AWS.config.credentials = {
  accessKeyId: "dummyKeyId",
  secretAccessKey: "dummySecretKey",
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
        { AttributeName: "id", KeyType: "HASH" }, // Partition key
      ],
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
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

// Middleware to parse JSON request bodies
app.use(express.json());

app.post("/todos", async (req, res) => {
  try {
    const { title, content, focusArea } = req.body;

    if (!title) {
      return res.status(400).send({ message: "Title is required." });
    }

    const newTodo = {
      id: require("crypto").randomUUID(), // Generate a unique ID
      title,
      content: content || "",
      focusArea: focusArea || "",
      completed: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const params = {
      TableName: tableName,
      Item: newTodo,
    };

    await dynamodb.put(params).promise();

    res.status(201).send(newTodo); // Respond with the newly created to-do
  } catch (error) {
    console.error("Error adding to-do:", error);
    res.status(500).send({ message: "Failed to add to-do." });
  }
});

app.get("/todos", async (req, res) => {
  try {
    const params = {
      TableName: tableName,
    };

    const result = await dynamodb.scan(params).promise();
    res.status(200).send(result.Items); // Send the array of to-do items
  } catch (error) {
    console.error("Error getting to-dos:", error);
    res.status(500).send({ message: "Failed to retrieve to-dos." });
  }
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
