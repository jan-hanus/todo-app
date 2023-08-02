import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DeleteItemInput, DynamoDB} from '@aws-sdk/client-dynamodb'
import {marshall, unmarshall} from '@aws-sdk/util-dynamodb'
import {PublishCommand, PublishInput, SNSClient} from "@aws-sdk/client-sns";

interface DeleteTodo {
    id: string
}

const dynamoClient = new DynamoDB({
    region: 'us-east-1'
})

const snsClient = new SNSClient({
    region: 'us-east-1'
})

export async function deleteTodo(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {

    console.debug(`Incoming event with pathParams: ${event.pathParameters?.id}`)
    const todoId = event.pathParameters?.id

    if (!todoId) {

        return sendFail('invalid request')
    }

    const { id } = {id: todoId} as DeleteTodo

    const todoParams: DeleteItemInput = {
        Key: marshall({ id }),
        ReturnValues: 'ALL_OLD',
        TableName: process.env.TODO_TABLE_NAME
    }

    try {

        const { Attributes } = await dynamoClient.deleteItem(todoParams)

        await snsClient.send(new PublishCommand({
            TargetArn: process.env.TODO_TOPIC,
            Subject: "DELETE",
            Message: JSON.stringify({ id })
        } as PublishInput))

        const todo = Attributes ? unmarshall(Attributes) : null

        return {
            statusCode: 200,
            body: JSON.stringify(todo)
        }

    } catch (err) {

        console.log(err)

        return sendFail('something went wrong')
    }
}

function sendFail(message: string): APIGatewayProxyResultV2 {

    return {
        statusCode: 400,
        body: JSON.stringify({ message })
    }
}