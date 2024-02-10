import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { voting } from '../../utils/volting-pub-sub'

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

        const votes = await redis.zincrby(pollId, -1, userPreviousVoteOnPoll.pollOptionId)

        voting.publish(pollId, {
          pollOptionId: userPreviousVoteOnPoll.pollOptionId, 
          votes: Number(votes)
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

    const votes = await redis.zincrby(pollId, 1, pollOptionId )

    voting.publish(pollId, {
      pollOptionId, 
      votes: Number(votes)
    })

    return reply.status(201).send({ sessionId })
  })
}