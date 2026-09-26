# API Reference

## POST /api/rewrite

Rewrites input text in the specified tone.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Input text (1-5000 chars) |
| `tone` | string | No | `formal`, `casual`, or `neutral` (default) |

### Response

```json
{
  "result": "Rewritten text...",
  "tokens_used": 42,
  "cached": false
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `RATE_LIMIT` | 429 | Too many requests |
