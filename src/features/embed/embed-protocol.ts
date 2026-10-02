import { z } from 'zod';

/**
 * Embed Mode — URL query parameters for iframe embedding.
 *
 * When loaded with `?embed=1`, the configurator hides its own
 * header/footer and communicates with the parent window via postMessage.
 *
 * Security: All received messages are validated with Zod schemas.
 * Only messages matching the protocol schema and from the allowed
 * origin are accepted.
 */

/* ── Query Parameters ── */

export const EmbedParamsSchema = z.object({
  embed: z.enum(['1', 'true']).optional(),
  productId: z.string().min(1).optional(),
  origin: z.string().url().optional(),
  theme: z.enum(['dark', 'light']).optional(),
});

export type EmbedParams = z.infer<typeof EmbedParamsSchema>;

export function parseEmbedParams(): EmbedParams {
  const params = new URLSearchParams(window.location.search);
  const raw = Object.fromEntries(params.entries());
  const result = EmbedParamsSchema.safeParse(raw);
  return result.success ? result.data : {};
}

export function isEmbedMode(): boolean {
  const params = parseEmbedParams();
  return params.embed === '1' || params.embed === 'true';
}

/* ── PostMessage Protocol ── */

/**
 * Message types from the Configurator (iframe) → Parent window:
 *
 * READY: Sent once when the configurator is mounted and ready.
 * CONFIGURATION_CHANGED: Sent whenever the user changes any option/design.
 * ADD_TO_CART_REQUESTED: Sent when the user clicks Add to Cart in embed mode.
 *   The parent handles the actual cart addition via its own Shopify session.
 * PRICE_UPDATED: Sent when a new price quote is computed.
 */
export const OutboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CONFIGURATOR_READY'),
    version: z.string(),
    productId: z.string(),
  }),
  z.object({
    type: z.literal('CONFIGURATION_CHANGED'),
    configurationId: z.string(),
    options: z.record(z.string(), z.string()),
    sizeId: z.string(),
  }),
  z.object({
    type: z.literal('ADD_TO_CART_REQUESTED'),
    variantId: z.string(),
    quantity: z.number().int().positive(),
    configurationId: z.string(),
    quoteId: z.string(),
    quoteTotalCents: z.number().int(),
    quoteSignature: z.string(),
    properties: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal('PRICE_UPDATED'),
    totalCents: z.number().int(),
    currency: z.string().length(3),
  }),
]);

export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;

/**
 * Message types from the Parent window → Configurator (iframe):
 *
 * SET_CONFIGURATION: Parent can programmatically set configuration.
 * SET_OPTION: Parent can set a specific option.
 */
export const InboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SET_CONFIGURATION'),
    configurationId: z.string(),
  }),
  z.object({
    type: z.literal('SET_OPTION'),
    groupId: z.string(),
    choiceId: z.string(),
  }),
]);

export type InboundMessage = z.infer<typeof InboundMessageSchema>;

/* ── Messaging helpers ── */

const MESSAGE_NAMESPACE = 'tent-configurator';

export function postToParent(message: OutboundMessage): void {
  if (!isEmbedMode()) return;

  const params = parseEmbedParams();
  const targetOrigin = params.origin ?? '*';

  window.parent.postMessage(
    { namespace: MESSAGE_NAMESPACE, ...message },
    targetOrigin,
  );
}

/**
 * Listens for validated inbound messages from the parent window.
 * Returns a cleanup function for the event listener.
 */
export function listenForParentMessages(
  handler: (message: InboundMessage) => void,
  allowedOrigin?: string,
): () => void {
  function onMessage(event: MessageEvent) {
    /* Origin check */
    if (allowedOrigin && event.origin !== allowedOrigin) return;

    /* Namespace check */
    const data = event.data as Record<string, unknown>;
    if (data?.namespace !== MESSAGE_NAMESPACE) return;

    /* Schema validation — reject malformed messages */
    const result = InboundMessageSchema.safeParse(data);
    if (result.success) {
      handler(result.data);
    }
  }

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
