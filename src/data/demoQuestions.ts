import { subDays } from 'date-fns';
import { createQuestion, calculateRevisionSchedule } from '../core/revision/engine';
import { format } from 'date-fns';
import type { Question } from '../types';

const examples = [
  ['Two Sum', 'Arrays', 'Easy', 'Find two indices whose values add to the target.', 'Use a hash map from value to index. For each number, check whether its complement has been seen; otherwise store the current value.'],
  ['Valid Parentheses', 'Stack', 'Easy', 'Determine whether brackets are balanced and correctly nested.', 'Push opening brackets. For every closing bracket, verify it matches the stack top. The stack must be empty at the end.'],
  ['Binary Search', 'Binary Search', 'Easy', 'Find a target in a sorted array in logarithmic time.', 'Maintain an inclusive low/high interval. Compare the middle element and discard the half that cannot contain the target.'],
  ['Merge Two Sorted Lists', 'Linked Lists', 'Easy', 'Merge two sorted linked lists into one sorted list.', 'Use a dummy head and advance a pointer, always attaching the smaller current node. Append the remaining list.'],
  ['Maximum Subarray', 'Dynamic Programming', 'Medium', 'Find the contiguous subarray with the largest sum.', 'Kadane’s algorithm tracks the best sum ending at this element and the best global sum.'],
  ['Reverse Linked List', 'Linked Lists', 'Easy', 'Reverse a singly linked list in place.', 'Iterate while saving next, then point current.next to previous and advance both pointers.'],
  ['Valid Anagram', 'Strings', 'Easy', 'Check whether two strings contain the same characters with the same frequencies.', 'Count characters from one string and decrement counts while scanning the other.'],
  ['Best Time to Buy and Sell Stock', 'Arrays', 'Easy', 'Maximize profit from one buy followed by one sell.', 'Track the minimum price seen so far and the best difference at every day.'],
  ['Flood Fill', 'Graphs', 'Easy', 'Recolor the connected component containing a starting pixel.', 'Use DFS or BFS from the start, visiting only pixels with the original color.'],
  ['Number of Islands', 'Graphs', 'Medium', 'Count connected groups of land in a grid.', 'Scan cells; when unvisited land is found, increment the count and flood-fill that component.'],
  ['Climbing Stairs', 'Dynamic Programming', 'Easy', 'Count ways to reach step n when taking one or two steps.', 'Use the Fibonacci recurrence: ways(n) = ways(n-1) + ways(n-2).'],
  ['House Robber', 'Dynamic Programming', 'Medium', 'Maximize non-adjacent house values.', 'At each house choose between the previous best and current value plus the best from two houses back.'],
  ['Course Schedule', 'Graphs', 'Medium', 'Determine if all courses can be completed given prerequisites.', 'Build a directed graph and use Kahn’s topological sort; all nodes must be processed.'],
  ['Kth Largest Element', 'Heap', 'Medium', 'Find the kth largest array element.', 'Maintain a min-heap of size k; its root is the kth largest element.'],
  ['Word Break', 'Dynamic Programming', 'Medium', 'Check if a string can be segmented into dictionary words.', 'Dynamic programming over string prefixes: dp[i] is true if some valid earlier prefix plus a dictionary word reaches i.'],
] as const;

export function makeDemoQuestions(now = new Date()): Question[] {
  const today = format(now, 'yyyy-MM-dd');
  return examples.map(([title, topic, difficulty, problem, solution], index) => {
    const ageDays = [0, 2, 4, 7, 10, 16, 22, 35, 61, 3, 5, 14, 29, 55, 118][index];
    const createdAt = format(subDays(now, ageDays), 'yyyy-MM-dd');
    const question = createQuestion({
      title,
      topic,
      difficulty,
      problem,
      solution,
      tags: [topic],
      source: 'LeetCode',
      url: 'https://leetcode.com/problemset/',
      createdAt,
    });
    question.id = `demo-${index + 1}`;
    question.revisionSchedule = calculateRevisionSchedule(createdAt);
    const completed = question.revisionSchedule.reduce<number[]>((stages, date, stage) => {
      if ((stage === 0 && createdAt < today) || (stage > 0 && date < today)) stages.push(stage);
      return stages;
    }, []);
    question.completedStages = completed;
    question.nextReviewDate = question.revisionSchedule[Math.min(completed.length, 6)];
    question.reviewHistory = completed.filter((stage) => stage > 0).map((stage) => ({
      id: `demo-review-${index + 1}-${stage}`,
      date: question.revisionSchedule[stage],
      stage,
      result: question.difficulty === 'Hard' ? 'hard' : 'good',
      xp: 25,
    }));
    return question;
  });
}
