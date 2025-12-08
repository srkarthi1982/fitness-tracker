import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "node:crypto";
import { and, db, eq, WorkoutExercises, WorkoutSessions } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getSessionForUser(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(WorkoutSessions)
    .where(and(eq(WorkoutSessions.id, sessionId), eq(WorkoutSessions.userId, userId)));

  if (!session) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Workout session not found.",
    });
  }

  return session;
}

export const server = {
  createWorkoutSession: defineAction({
    input: z.object({
      title: z.string().min(1).optional(),
      workoutDate: z.coerce.date().optional(),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      workoutType: z.string().min(1).optional(),
      notes: z.string().optional(),
      totalDurationMinutes: z.number().int().positive().optional(),
      totalCalories: z.number().int().nonnegative().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();
      const session = {
        id: randomUUID(),
        userId: user.id,
        title: input.title,
        workoutDate: input.workoutDate ?? now,
        startTime: input.startTime,
        endTime: input.endTime,
        workoutType: input.workoutType,
        notes: input.notes,
        totalDurationMinutes: input.totalDurationMinutes,
        totalCalories: input.totalCalories,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof WorkoutSessions.$inferInsert;

      await db.insert(WorkoutSessions).values(session);

      return {
        success: true,
        data: { session },
      };
    },
  }),

  updateWorkoutSession: defineAction({
    input: z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      workoutDate: z.coerce.date().optional(),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      workoutType: z.string().min(1).optional(),
      notes: z.string().optional(),
      totalDurationMinutes: z.number().int().positive().optional(),
      totalCalories: z.number().int().nonnegative().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getSessionForUser(input.id, user.id);

      const updateData: Partial<typeof WorkoutSessions.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.workoutDate !== undefined) updateData.workoutDate = input.workoutDate;
      if (input.startTime !== undefined) updateData.startTime = input.startTime;
      if (input.endTime !== undefined) updateData.endTime = input.endTime;
      if (input.workoutType !== undefined) updateData.workoutType = input.workoutType;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.totalDurationMinutes !== undefined)
        updateData.totalDurationMinutes = input.totalDurationMinutes;
      if (input.totalCalories !== undefined) updateData.totalCalories = input.totalCalories;

      await db
        .update(WorkoutSessions)
        .set(updateData)
        .where(and(eq(WorkoutSessions.id, input.id), eq(WorkoutSessions.userId, user.id)));

      const [session] = await db
        .select()
        .from(WorkoutSessions)
        .where(and(eq(WorkoutSessions.id, input.id), eq(WorkoutSessions.userId, user.id)));

      return {
        success: true,
        data: { session },
      };
    },
  }),

  deleteWorkoutSession: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getSessionForUser(input.id, user.id);

      await db
        .delete(WorkoutExercises)
        .where(and(eq(WorkoutExercises.sessionId, input.id), eq(WorkoutExercises.userId, user.id)));

      await db
        .delete(WorkoutSessions)
        .where(and(eq(WorkoutSessions.id, input.id), eq(WorkoutSessions.userId, user.id)));

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),

  listMyWorkoutSessions: defineAction({
    input: z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const offset = (input.page - 1) * input.pageSize;

      const sessions = await db
        .select()
        .from(WorkoutSessions)
        .where(eq(WorkoutSessions.userId, user.id))
        .limit(input.pageSize)
        .offset(offset);

      return {
        success: true,
        data: {
          items: sessions,
          total: sessions.length,
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    },
  }),

  getWorkoutSessionWithExercises: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const session = await getSessionForUser(input.id, user.id);

      const exercises = await db
        .select()
        .from(WorkoutExercises)
        .where(and(eq(WorkoutExercises.sessionId, input.id), eq(WorkoutExercises.userId, user.id)));

      return {
        success: true,
        data: { session, exercises },
      };
    },
  }),

  upsertWorkoutExercise: defineAction({
    input: z.object({
      id: z.string().optional(),
      sessionId: z.string(),
      name: z.string().min(1),
      category: z.string().optional(),
      sets: z.number().int().positive().optional(),
      repsPerSet: z.number().int().positive().optional(),
      weightPerRep: z.number().positive().optional(),
      distanceKm: z.number().positive().optional(),
      durationMinutes: z.number().positive().optional(),
      caloriesBurned: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getSessionForUser(input.sessionId, user.id);

      if (input.id) {
        const [existing] = await db
          .select()
          .from(WorkoutExercises)
          .where(and(eq(WorkoutExercises.id, input.id), eq(WorkoutExercises.userId, user.id)));

        if (!existing) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Workout exercise not found.",
          });
        }

        const updateData: Partial<typeof WorkoutExercises.$inferInsert> = {
          sessionId: input.sessionId,
          name: input.name,
        };

        if (input.category !== undefined) updateData.category = input.category;
        if (input.sets !== undefined) updateData.sets = input.sets;
        if (input.repsPerSet !== undefined) updateData.repsPerSet = input.repsPerSet;
        if (input.weightPerRep !== undefined) updateData.weightPerRep = input.weightPerRep;
        if (input.distanceKm !== undefined) updateData.distanceKm = input.distanceKm;
        if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
        if (input.caloriesBurned !== undefined) updateData.caloriesBurned = input.caloriesBurned;
        if (input.notes !== undefined) updateData.notes = input.notes;

        await db
          .update(WorkoutExercises)
          .set(updateData)
          .where(and(eq(WorkoutExercises.id, input.id), eq(WorkoutExercises.userId, user.id)));

        const [exercise] = await db
          .select()
          .from(WorkoutExercises)
          .where(and(eq(WorkoutExercises.id, input.id), eq(WorkoutExercises.userId, user.id)));

        return {
          success: true,
          data: { exercise },
        };
      }

      const exercise = {
        id: randomUUID(),
        sessionId: input.sessionId,
        userId: user.id,
        name: input.name,
        category: input.category,
        sets: input.sets,
        repsPerSet: input.repsPerSet,
        weightPerRep: input.weightPerRep,
        distanceKm: input.distanceKm,
        durationMinutes: input.durationMinutes,
        caloriesBurned: input.caloriesBurned,
        notes: input.notes,
        createdAt: new Date(),
      } satisfies typeof WorkoutExercises.$inferInsert;

      await db.insert(WorkoutExercises).values(exercise);

      return {
        success: true,
        data: { exercise },
      };
    },
  }),

  deleteWorkoutExercise: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const [exercise] = await db
        .select()
        .from(WorkoutExercises)
        .where(and(eq(WorkoutExercises.id, input.id), eq(WorkoutExercises.userId, user.id)));

      if (!exercise) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Workout exercise not found.",
        });
      }

      await db
        .delete(WorkoutExercises)
        .where(and(eq(WorkoutExercises.id, input.id), eq(WorkoutExercises.userId, user.id)));

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),
};
