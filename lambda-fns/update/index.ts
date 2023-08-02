import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDB, UpdateItemInput} from '@aws-sdk/client-dynamodb'
import {marshall, unmarshall} from '@aws-sdk/util-dynamodb'
import {PublishCommand, PublishInput, SNSClient} from "@aws-sdk/client-sns";

interface UpdateTodo {
    id: string
    done: boolean
    phone: string
    duedate: string
    title: string
    owner: string
}

const dynamoClient = new DynamoDB({
    region: 'us-east-1'
})

const snsClient = new SNSClient({
    region: 'us-east-1'
})

export async function update(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {

    console.debug(`Incoming event with path: ${event.pathParameters?.id}, body: ${event.body}`)
    if (!event.body || !event.pathParameters?.id) {

        return sendFail('invalid request')
    }

    let updateTodo = JSON.parse(event.body) as UpdateTodo;
    updateTodo.id = event.pathParameters!.id
    const { done, phone, duedate, title, owner } = updateTodo

    const todoParams: UpdateItemInput = {
        Key: marshall({ id: event.pathParameters?.id }),
        UpdateExpression: 'set #done = :done, #phone = :phone, #duedate = :duedate, #title = :title, #owner_name = :owner_name',
        ExpressionAttributeValues: marshall({
            ':done': done,
            ':phone': phone,
            ':duedate': duedate,
            ':title': title,
            ':owner_name': owner
        }),
        ExpressionAttributeNames: {
            '#done': 'done',
            '#phone': 'phone',
            '#duedate': 'duedate',
            '#title': 'title',
            '#owner_name': 'owner'
        },
        ReturnValues: 'ALL_NEW',
        TableName: process.env.TODO_TABLE_NAME
    }

    try {

        const { Attributes } = await dynamoClient.updateItem(todoParams)

        await snsClient.send(new PublishCommand({
            TargetArn: process.env.TODO_TOPIC,
            Subject: "UPDATE",
            Message: JSON.stringify(updateTodo)
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
        statusCode: 200,
        body: JSON.stringify({ message })
    }
}