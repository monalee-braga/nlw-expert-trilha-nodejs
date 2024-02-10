import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export async function voteOnPoll (app: FastifyInstance) {
  app.post('/poll/:pollId/vote', async (request, reply) => {
    const voteOnParams = z.object({
      pollId: z.string().uuid()
    })

    const voteOnPollBody = z.object({
      pollOptionId: z.string().uuid()
    })

    const { pollId  } = voteOnParams.parse(request.params)
    const { pollOptionId } = voteOnPollBody.parse(request.body)


    let { sessionId } = request.cookies

    if (sessionId) {
      const userPreviousVoteOnPoll = await prisma.vote.findUnique({
        where: {
          sessionId_pollId: {
            sessionId, 
            pollId,
          }
        }
      })

      if (userPreviousVoteOnPoll && userPreviousVoteOnPoll.pollOptionId !== pollOptionId) {
        await prisma.vote.delete({
          where: {
            id: userPreviousVoteOnPoll.id
          }
        })
      } else if (userPreviousVoteOnPoll){
        return reply.status(400).send(new Error('User already voted on this poll'))
      }
    }

    if (!sessionId) {
      sessionId = randomUUID()

      reply.setCookie('sessionId', sessionId, {
        path: '/', 
        maxAge: 60 * 60 * 24 * 30, // 30 dias, 
        signed: true, 
        httpOnly: true,
      })
    }

    await prisma.vote.create({
      data: {
        sessionId, 
        pollId, 
        pollOptionId,
      }
    })

    return reply.status(201).send({ sessionId })
  })
}