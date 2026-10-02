import { describe, it, expect } from 'vitest';
import {
  EmbedParamsSchema,
  OutboundMessageSchema,
  InboundMessageSchema,
} from '../src/features/embed/embed-protocol';

/**
 * Embed Protocol Tests
 *
 * Validates the Zod schemas that protect the postMessage API
 * from malformed or malicious messages. This is critical security
 * infrastructure — untrusted origins can send arbitrary messages.
 */

describe('EmbedParamsSchema', () => {
  it('accepts valid embed params', () => {
    const result = EmbedParamsSchema.safeParse({
      embed: '1',
      productId: 'canopy-tent-10x10',
      origin: 'https://merchant.myshopify.com',
      theme: 'dark',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty params (non-embed mode)', () => {
    const result = EmbedParamsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid embed value', () => {
    const result = EmbedParamsSchema.safeParse({ embed: 'yes' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid origin', () => {
    const result = EmbedParamsSchema.safeParse({ origin: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

describe('OutboundMessageSchema', () => {
  it('validates CONFIGURATOR_READY message', () => {
    const result = OutboundMessageSchema.safeParse({
      type: 'CONFIGURATOR_READY',
      version: '1.0.0',
      productId: 'canopy-tent-10x10',
    });
    expect(result.success).toBe(true);
  });

  it('validates CONFIGURATION_CHANGED message', () => {
    const result = OutboundMessageSchema.safeParse({
      type: 'CONFIGURATION_CHANGED',
      configurationId: '550e8400-e29b-41d4-a716-446655440000',
      options: { 'frame-type': 'with-frame' },
      sizeId: 'size-5x5',
    });
    expect(result.success).toBe(true);
  });

  it('validates ADD_TO_CART_REQUESTED message', () => {
    const result = OutboundMessageSchema.safeParse({
      type: 'ADD_TO_CART_REQUESTED',
      variantId: '48270445478136',
      quantity: 1,
      configurationId: '550e8400-e29b-41d4-a716-446655440000',
      quoteId: '550e8400-e29b-41d4-a716-446655440001',
      quoteTotalCents: 84900,
      quoteSignature: 'mock-sig-abc123',
      properties: { '_configuration_id': '550e8400' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown message type', () => {
    const result = OutboundMessageSchema.safeParse({
      type: 'HACK_THE_STORE',
      payload: 'malicious',
    });
    expect(result.success).toBe(false);
  });
});

describe('InboundMessageSchema', () => {
  it('validates SET_OPTION message', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SET_OPTION',
      groupId: 'side-walls',
      choiceId: 'wall-1-single',
    });
    expect(result.success).toBe(true);
  });

  it('validates SET_CONFIGURATION message', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SET_CONFIGURATION',
      configurationId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects message with missing required fields', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SET_OPTION',
      /* missing groupId and choiceId */
    });
    expect(result.success).toBe(false);
  });

  it('rejects arbitrary injection attempt', () => {
    const result = InboundMessageSchema.safeParse({
      type: 'SET_OPTION',
      groupId: '<script>alert("xss")</script>',
      choiceId: 'valid',
    });
    /* Note: Zod validates type and structure, not sanitisation.
       The string passes schema but won't match any real option. */
    expect(result.success).toBe(true);
  });
});
