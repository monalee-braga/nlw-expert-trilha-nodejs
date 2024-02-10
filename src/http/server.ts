import fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const app = fastify()
const prisma = new PrismaClient()



app.post('/poll', async (request, reply) => {
  const createPollBody = z.object({
    title: z.string(),
  })

  const { title } = createPollBody.parse(request.body)

  const poll = await prisma.poll.create({
    data: {
      title,
    }
  })

  return reply.status(201).send({ pollId: poll.id })
})

app.listen({ port: 3333 }).then(() => {
  console.log('Server started on http://localhost:3333')
})