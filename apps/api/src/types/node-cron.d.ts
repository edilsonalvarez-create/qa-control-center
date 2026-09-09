declare module "node-cron" {
  export interface ScheduleOptions {
    timezone?: string;
    scheduled?: boolean;
  }
  export function schedule(expression: string, func: () => void, options?: ScheduleOptions): { stop: () => void };
  export function validate(expression: string): boolean;
  const cron: { schedule: typeof schedule; validate: typeof validate };
  export default cron;
}
