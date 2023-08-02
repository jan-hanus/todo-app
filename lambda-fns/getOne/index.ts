import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDB, GetItemInput } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

interface UserInput {
    id: string
}

export async function getOne(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {

    console.debug(`Incoming event with pathParams: ${event.pathParameters?.id}`)
    const todoId = event.pathParameters?.id

    if (!todoId) return sendError('invalid request')

    const data = {id: todoId} as UserInput

    const dynamoClient = new DynamoDB({
        region: 'us-east-1'
    })

    const getTodo: GetItemInput = {
        Key: marshall({
            id: data.id
        }),
        TableName: process.env.TODO_TABLE_NAME
    }

    try {

        const { Item } = await dynamoClient.getItem(getTodo)

        const todo = Item ? unmarshall(Item) : null

        return {
            statusCode: 200,
            body: JSON.stringify(todo)
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