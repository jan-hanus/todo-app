import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDB, PutItemInput} from '@aws-sdk/client-dynamodb'
import {marshall} from '@aws-sdk/util-dynamodb'
import {v4 as uuid} from 'uuid'
import {PublishCommand, PublishInput, SNSClient} from "@aws-sdk/client-sns";

interface TodoInput {
    id?: string
    owner?: string
    title: string
    done: boolean
    phone: string
    duedate: string
}

interface Todo {
    id: string
    owner?: string
    title: string
    done: boolean
    phone: string
    duedate: string
}

const dynamoClient = new DynamoDB({
    region: 'us-east-1'
})

const snsClient = new SNSClient({
    region: 'us-east-1'
})
export async function createTodo(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {

    console.debug(`Incoming event: ${event.body}`)

    const { body } = event

    if (!body) {
        return sendFail('invalid request')
    }

    const { id, owner, title, done, phone, duedate } = JSON.parse(body) as TodoInput

    const newTodo: Todo = {
        id: id ?? uuid(),
        owner, title, done, phone, duedate
    }


    const todoParams: PutItemInput = {
        Item: marshall(newTodo),
        TableName: process.env.TODO_TABLE_NAME
    }
    try {
        await dynamoClient.putItem(todoParams)
        await snsClient.send(new PublishCommand({
            TargetArn: process.env.TODO_TOPIC,
            Subject: "CREATE",
            Message: JSON.stringify(newTodo)
        } as PublishInput))
        return {
            statusCode: 200,
            body: JSON.stringify(newTodo)
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