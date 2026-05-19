# JSON Schema Specification

## Root Structure

```json
{
  "schema_id": "string (required)",
  "version": "integer (required)",
  "fields": { ... },
  "rules": [ ... ],
  "constants": { ... }
}
```

## Field Definition

```json
{
  "field_name": {
    "type": "string | number | boolean | select | date | textarea | file",
    "label": "string",
    "required": "boolean (default: false)",
    "default": "any",
    "min": "number (for numbers) | integer (for strings)",
    "max": "number (for numbers) | integer (for strings)",
    "pattern": "regex string",
    "options": [{"value": "string", "label": "string"}],
    "placeholder": "string",
    "helper_text": "string"
  }
}
```

## Rule Definition

```json
{
  "depends_on": ["field1", "field2"],
  "condition": "field1 === 'value' && field2 > 10",
  "actions": [...]
}
```

## Action Types

### show / hide

```json
{ "type": "show", "field": "target_field" }
{ "type": "hide", "field": "target_field" }
```

### setRequired

```json
{ "type": "setRequired", "field": "target_field", "required": true }
```

### setValue

```json
{ "type": "setValue", "field": "target_field", "value": "static value" }
```

### setError

```json
{ "type": "setError", "field": "target_field", "message": "Error text" }
```

### populateSelect

```json
{
  "type": "populateSelect",
  "field": "states",
  "source": "/api/states?country={{country}}",
  "method": "GET",
  "valuePath": "$.data[*].{value:code, label:name}",
  "cache": "session",
  "debounce": 300,
  "prefetch": true
}
```

## Complete Example

```json
{
  "schema_id": "address-form",
  "version": 1,
  "fields": {
    "country": {
      "type": "select",
      "label": "Country",
      "required": true,
      "options": [
        {"value": "US", "label": "United States"},
        {"value": "CA", "label": "Canada"}
      ]
    },
    "states": {
      "type": "select",
      "label": "State",
      "required": true,
      "options": []
    }
  },
  "rules": [
    {
      "depends_on": ["country"],
      "condition": "country !== null",
      "actions": [
        {
          "type": "populateSelect",
          "field": "states",
          "source": "/api/states?country={{country}}",
          "valuePath": "$.data[*].{value:code, label:name}",
          "cache": "session",
          "debounce": 300
        }
      ]
    }
  ]
}
