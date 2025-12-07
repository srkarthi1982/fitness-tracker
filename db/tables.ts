/**
 * Fitness Tracker - log workouts & activities.
 *
 * Design goals:
 * - Track workout sessions and exercises.
 * - Simple stats: duration, calories, distance.
 * - Flexible enough for gym + running + cycling.
 */

import { defineTable, column, NOW } from "astro:db";

export const WorkoutSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    title: column.text({ optional: true }),        // "Morning Run", "Push Day"
    workoutDate: column.date({ default: NOW }),
    startTime: column.date({ optional: true }),
    endTime: column.date({ optional: true }),

    workoutType: column.text({ optional: true }),  // "cardio", "strength", "yoga", etc.
    notes: column.text({ optional: true }),

    totalDurationMinutes: column.number({ optional: true }),
    totalCalories: column.number({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const WorkoutExercises = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => WorkoutSessions.columns.id,
    }),
    userId: column.text(),

    name: column.text(),                           // "Bench Press", "Running"
    category: column.text({ optional: true }),     // "strength", "cardio", etc.

    // Strength fields
    sets: column.number({ optional: true }),
    repsPerSet: column.number({ optional: true }),
    weightPerRep: column.number({ optional: true }), // in kg

    // Cardio fields
    distanceKm: column.number({ optional: true }),
    durationMinutes: column.number({ optional: true }),

    caloriesBurned: column.number({ optional: true }),
    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  WorkoutSessions,
  WorkoutExercises,
} as const;
