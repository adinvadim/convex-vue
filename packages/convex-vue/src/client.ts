import { ConvexClient, MutationOptions } from 'convex/browser';
import {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  getFunctionName
} from 'convex/server';

export class ConvexVueClient extends ConvexClient {
  async mutation<
    Mutation extends FunctionReference<'mutation'>
  >(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    options?: MutationOptions
  ): Promise<Awaited<FunctionReturnType<Mutation>>> {
    if (this.disabled) throw new Error('ConvexClient is disabled');

    return await this.client.mutation(getFunctionName(mutation), args, options);
  }
}
