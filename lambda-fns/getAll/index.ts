import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {DynamoDB, QueryInput, ScanInput} from '@aws-sdk/client-dynamodb'
import {marshall, unmarshall} from '@aws-sdk/util-dynamodb'

const dynamoClient = new DynamoDB({
    region: 'us-east-1'
})

const scanTodo: ScanInput = {
    TableName: process.env.TODO_TABLE_NAME
}

export async function getAll(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {

    console.debug(`Incoming event with queryParam: ${event.pathParameters?.owner}`)
    const owner = event.queryStringParameters?.owner

    if (owner) {
        return await queryOwner(owner);
    } else {
        try {
            const { Items } = await dynamoClient.scan(scanTodo)
            const userData = Items ? Items.map(item => unmarshall(item)) : []
            return {
                statusCode: 200,
                body: JSON.stringify(userData)
            }
        } catch (err) {
            console.log(err)
            return sendError('something went wrong')
        }
    }
}

const queryOwner = async (owner: string): Promise<APIGatewayProxyResultV2> => {
    const queryTodo: QueryInput = {
        KeyConditionExpression: '#todoOwner = :userId',
        ExpressionAttributeNames: {
            '#todoOwner': 'owner'
        },
        ExpressionAttributeValues: marshall({
            ':userId': owner
        }),
        IndexName: 'ownerIndex',
        TableName: process.env.TODO_TABLE_NAME
    }

    try {

        const {Items} = await dynamoClient.query(queryTodo)
        const listTodo = Items ? Items.map(item => unmarshall(item)) : []
        return {
            statusCode: 200,
            body: JSON.stringify(listTodo)
        }
    } catch (err) {
        console.log(err)
        return sendError('something went wrong')
    }
}

function sendError(message: string): APIGatewayProxyResultV2 {

    return {
        statusCode: 400,
        body: JSON.stringify({ message })
    }
}
