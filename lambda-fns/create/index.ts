import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDB, PutItemInput} from '@aws-sdk/client-dynamodb'
import {marshall} from '@aws-sdk/util-dynamodb'
import {v4 as uuid} from 'uuid'
import {PublishCommand, PublishInput, SNSClient} from "@aws-sdk/client-sns";
import {Tracer} from "@aws-lambda-powertools/tracer";

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

const tracer = new Tracer();
export async function createTodo(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const segment = tracer.getSegment();
    const handlerSegment = segment?.addNewSubsegment(`## ${process.env._HANDLER}`);
    if (handlerSegment) {
        tracer.setSegment(handlerSegment);
        tracer.annotateColdStart();
        tracer.addServiceNameAnnotation();
    }
    console.debug(`Incoming event: ${event.body}`)

    const { body } = event

    if (!body) {
        return sendFail('invalid request')
    }

    const { id, owner, title, done, phone, duedate } = JSON.parse(body) as TodoInput

    if (owner) {
        tracer.putAnnotation('todo.owner', owner)
    }
    const newTodo: Todo = {
        id: id ?? uuid(),
        owner, title, done, phone, duedate
    }


    const todoParams: PutItemInput = {
        Item: marshall(newTodo),
        TableName: process.env.TODO_TABLE_NAME
    }
    try {
        let subsegment
        if (handlerSegment) {
            subsegment = handlerSegment.addNewSubsegment('dynamodb-put')
            tracer.setSegment(subsegment)
        }
        await dynamoClient.putItem(todoParams)
        if (subsegment) {
            subsegment.close()
            subsegment = null
        }
        if (handlerSegment) {
            subsegment = handlerSegment.addNewSubsegment('sns-publish')
            tracer.setSegment(subsegment)
        }
        await snsClient.send(new PublishCommand({
            TargetArn: process.env.TODO_TOPIC,
            Subject: "CREATE",
            Message: JSON.stringify(newTodo)
        } as PublishInput))
        if (subsegment) {
            subsegment.close()
        }
        handlerSegment?.close()
        if (segment) {
            tracer.setSegment(segment)
        }
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