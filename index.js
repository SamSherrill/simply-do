import { DynamoDBClient, CreateTableCommand, DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import express from 'express';
import { randomUUID } from 'crypto';

const app = express();
const port = 3000;

// Configure the AWS SDK to connect to DynamoDB Local (v3)
const ddbClient = new DynamoDBClient({
  region: 'us-west-2', // Dummy region for local
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'dummyKeyId',
    secretAccessKey: 'dummySecretKey',
  },
});

// Create a DynamoDB DocumentClient (v3), which simplifies working with DynamoDB items
const dynamodb = DynamoDBDocumentClient.from(ddbClient);
console.log("DynamoDB v3 DocumentClient created");

const ddb = new DynamoDB({
  region: 'us-west-2', // Dummy region for local
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'dummyKeyId',
    secretAccessKey: 'dummySecretKey',
  },
});

const tableName = "todos";

ddb.listTables({}, async (err, data) => {
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

    const command = new CreateTableCommand(params);

    try {
      const data = await ddb.send(command);
      console.log("Table created successfully:", data);
    } catch (error) {
      console.error("Error creating table:", error);
    }
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

// Add a new to-do
// Example: POST /todos
// This endpoint allows users to add a new to-do item.
// It expects a JSON body with the fields such as: title, notes, and focusArea.
// The title is required, while notes and focusArea are optional.
// If the title is missing, it returns a 400 Bad Request status with an error message
// The new to-do item is created with a unique ID, and the current timestamp for createdAt and updatedAt fields.
// The endpoint responds with the newly created to-do item.
app.post("/todos", async (req, res) => {
  try {
    const { title, notes, focusArea } = req.body;

    if (!title) {
      return res.status(400).send({ message: "Title is required." });
    }

    const newTodo = {
      id: randomUUID(),
      title,
      notes: notes || "",
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

    const command = new PutCommand(params);

    await dynamodb.send(command);

    res.status(201).send(newTodo); // Respond with the newly created to-do
  } catch (error) {
    console.error("Error adding to-do:", error);
    res.status(500).send({ message: "Failed to add to-do." });
  }
});

// Get all to-dos
// Example: GET /todos
// This endpoint retrieves all to-do items from the "todos" table in DynamoDB.
// It uses the DynamoDB DocumentClient to scan the table and return all items.
// The response includes an array of to-do items, each containing its details.
app.get("/todos", async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: tableName });

    const result = await dynamodb.send(command);
    res.status(200).send(result.Items); // Send the array of to-do items
  } catch (error) {
    console.error("Error getting to-dos:", error);
    res.status(500).send({ message: "Failed to retrieve to-dos." });
  }
});

// Get a specific to-do by ID
// Example: GET /todos/:id
// This endpoint retrieves a specific to-do item by its ID.
// It uses the DynamoDB DocumentClient to fetch the item from the "todos" table.
// The ID is passed as a URL parameter, and the response includes the to-do item if found.
app.get('/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const params = {
      TableName: tableName,
      Key: {
        id: id,
      },
    };

    const command = new GetCommand(params);

    const result = await dynamodb.send(command);

    if (result.Item) {
      res.status(200).send(result.Item);
    } else {
      res.status(404).send({ message: 'To-do not found.' });
    }
  } catch (error) {
    console.error('Error getting to-do:', error);
    res.status(500).send({ message: 'Failed to retrieve to-do.' });
  }
});

// UPDATE a specific to-do by ID
// Example: PUT /todos/:id
// This endpoint updates a specific to-do item by its ID.
// It allows partial updates, meaning the user can update only the fields they want to change.
// The request body can include any combination of fields: title, notes, focusArea, completed, and archived.
// The ID is passed as a URL parameter, and the response includes the updated to-do item.
app.put('/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { title, notes, focusArea, completed, archived } = req.body;

    const updateExpressionParts = [];
    const expressionAttributeValues = {};

    if (title !== undefined) {
      updateExpressionParts.push('title = :title');
      expressionAttributeValues[':title'] = title;
    }
    if (notes !== undefined) {
      updateExpressionParts.push('notes = :notes');
      expressionAttributeValues[':notes'] = notes;
    }
    if (focusArea !== undefined) {
      updateExpressionParts.push('focusArea = :focusArea');
      expressionAttributeValues[':focusArea'] = focusArea;
    }
    if (completed !== undefined) {
      updateExpressionParts.push('completed = :completed');
      expressionAttributeValues[':completed'] = completed;
    }
    if (archived !== undefined) {
      updateExpressionParts.push('archived = :archived');
      expressionAttributeValues[':archived'] = archived;
    }

    if (updateExpressionParts.length === 0) {
      return res.status(400).send({ message: 'No fields to update.' });
    }

    const updateExpression = 'set ' + updateExpressionParts.join(', ');

    const params = {
      TableName: tableName,
      Key: { id: id },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW', // Return the updated item
    };

    const command = new UpdateCommand(params);

    const result = await dynamodb.send(command);

    res.status(200).send(result.Attributes);
  } catch (error) {
    console.error('Error updating to-do:', error);
    res.status(500).send({ message: 'Failed to update to-do.' });
  }
});

// DELETE a specific to-do by ID
// Example: DELETE /todos/:id
// This endpoint deletes a specific to-do item by its ID.
// It uses the DynamoDB DocumentClient to remove the item from the "todos" table.
// The ID is passed as a URL parameter, and the response includes the deleted to-do item
// if it was found and deleted successfully.
app.delete('/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const params = {
      TableName: tableName,
      Key: {
        id: id,
      },
      ReturnValues: 'ALL_OLD', // Return the item that was deleted
    };

    const command = new DeleteCommand(params);

    const result = await dynamodb.send(command);

    if (result && result.Attributes) {
      res.status(200).send(result.Attributes);
    } else {
      res.status(404).send({ message: 'To-do not found.' });
    }
  } catch (error) {
    console.error('Error deleting to-do:', error);
    res.status(500).send({ message: 'Failed to delete to-do.' });
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
