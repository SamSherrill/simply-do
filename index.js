import { DynamoDBClient, ListTablesCommand, CreateTableCommand, DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import express from 'express';
import { randomUUID } from 'crypto';

// Configure the AWS SDK to connect to DynamoDB Local (v3)
const ddbClient = new DynamoDBClient({
  region: 'us-west-2', // Dummy region for local
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'dummyKeyId',
    secretAccessKey: 'dummySecretKey',
  },
});

// Create a DynamoDB DocumentClient (v3)
const dynamodb = DynamoDBDocumentClient.from(ddbClient);
console.log("DynamoDB v3 DocumentClient created");

const todosTableName = "todos";
const focusAreasTableName = "focus_areas";

const createTableIfNotExists = async (tableName, keySchema, attributeDefinitions) => {
  const listTablesCommand = new ListTablesCommand({});
  try {
    const { TableNames } = await ddbClient.send(listTablesCommand);
    if (!TableNames.includes(tableName)) {
      console.log(`Table "${tableName}" does not exist. Creating...`);
      const params = {
        TableName: tableName,
        KeySchema: keySchema,
        AttributeDefinitions: attributeDefinitions,
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      };
      const createTableCommand = new CreateTableCommand(params);
      await ddbClient.send(createTableCommand);
      console.log(`Table "${tableName}" created successfully.`);
    } else {
      console.log(`Table "${tableName}" already exists.`);
    }
  } catch (error) {
    console.error(`Error managing table "${tableName}":`, error);
  }
};

// Use top-level await to call the function for both tables
await createTableIfNotExists(todosTableName, [{ AttributeName: "id", KeyType: "HASH" }], [{ AttributeName: "id", AttributeType: "S" }]);
await createTableIfNotExists(focusAreasTableName, [{ AttributeName: "id", KeyType: "HASH" }], [{ AttributeName: "id", AttributeType: "S" }]);

const app = express();

app.use(express.json());

app.get('/', async (req, res) => {
  res.send('Hello World!');
});

app.post('/todos', async (req, res) => {
  try {
    const { title, notes, focusAreaId } = req.body;

    if (!title) {
      return res.status(400).send({ message: 'Title is required.' });
    }

    const newTodo = {
      id: randomUUID(),
      title,
      notes: notes || '',
      focusAreaId: focusAreaId || null, // Use focusAreaId and set to null if not provided
      completed: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const params = {
      TableName: todosTableName,
      Item: newTodo,
    };

    const command = new PutCommand(params);

    await dynamodb.send(command);

    res.status(201).send(newTodo); // Respond with the newly created to-do
  } catch (error) {
    console.error('Error adding to-do:', error);
    res.status(500).send({ message: 'Failed to add to-do.' });
  }
});

app.get('/todos', async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: todosTableName });
    const result = await dynamodb.send(command);
    res.status(200).send(result.Items); // Send the array of to-do items
  } catch (error) {
    console.error('Error getting to-dos:', error);
    res.status(500).send({ message: 'Failed to retrieve to-dos.' });
  }
});

app.get('/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const params = {
      TableName: todosTableName,
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

app.get('/focus-areas/:focusAreaId/todos', async (req, res) => {
  try {
    const focusAreaId = req.params.focusAreaId;

    const command = new ScanCommand({
      TableName: todosTableName,
      FilterExpression: "focusAreaId = :focusAreaId",
      ExpressionAttributeValues: {
        ":focusAreaId": focusAreaId,
      },
    });

    const result = await dynamodb.send(command);

    res.status(200).send(result.Items);
  } catch (error) {
    console.error('Error getting to-dos by focus area:', error);
    res.status(500).send({ message: 'Failed to retrieve to-dos by focus area.' });
  }
});

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
      console.log(notes)
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
      TableName: todosTableName,
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

app.delete('/todos/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const params = {
      TableName: todosTableName,
      Key: {
        id: id,
      },
      ReturnValues: 'ALL_OLD', // Return the item that was deleted
    };

    const command = new DeleteCommand(params);

    const result = await dynamodb.send(command);

    if (result && result.Attributes) { // Added check for result being defined
      res.status(200).send(result.Attributes);
    } else {
      res.status(404).send({ message: 'To-do not found.' });
    }
  } catch (error) {
    console.error('Error deleting to-do:', error);
    res.status(500).send({ message: 'Failed to delete to-do.' });
  }
});

const colorPalette = ["#a8dadc", "#457b9d", "#1d3557", "#f1faee", "#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#264653", "#d7dbe8", "#c2b0d1", "#a98cc2", "#a98cc2", "#774bb4"]; // Example calm color palette

app.post('/focus-areas', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).send({ message: 'Focus area name is required.' });
    }

    const newFocusArea = {
      id: randomUUID(),
      name: name,
      color: colorPalette[Math.floor(Math.random() * colorPalette.length)] // Assign a random color
    };

    const params = {
      TableName: focusAreasTableName,
      Item: newFocusArea,
    };

    const command = new PutCommand(params);

    await dynamodb.send(command);

    res.status(201).send(newFocusArea);
  } catch (error) {
    console.error('Error creating focus area:', error);
    res.status(500).send({ message: 'Failed to create focus area.' });
  }
});

app.get('/focus-areas', async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: focusAreasTableName });
    const result = await dynamodb.send(command);
    res.status(200).send(result.Items);
  } catch (error) {
    console.error('Error getting focus areas:', error);
    res.status(500).send({ message: 'Failed to retrieve focus areas.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});