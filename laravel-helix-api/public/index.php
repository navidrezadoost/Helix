<?php

declare(strict_types=1);

$storageFile = dirname(__DIR__) . '/storage/schemas.json';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
	http_response_code(204);
	exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

ensureStorage($storageFile);

if ($uri === '/api/v1/health') {
	respond(200, [
		'status' => 'ok',
		'service' => 'helix-preview-api',
		'storage' => basename($storageFile),
	]);
}

if ($uri === '/api/admin/test-data-source' && $method === 'POST') {
	$payload = readJsonBody();
	$url = trim((string) ($payload['url'] ?? ''));

	if ($url === '') {
		respond(422, ['error' => 'The url field is required.']);
	}

	$result = fetchRemote($payload);
	respond($result['status'], $result['body']);
}

if ($uri === '/api/admin/schemas' && $method === 'GET') {
	$schemas = array_values(filterSchemas(loadSchemas($storageFile), $_GET));
	usort($schemas, static fn (array $left, array $right) => strcmp((string) ($right['updated_at'] ?? ''), (string) ($left['updated_at'] ?? '')));

	respond(200, [
		'data' => $schemas,
		'current_page' => 1,
		'last_page' => 1,
		'per_page' => count($schemas),
		'total' => count($schemas),
	]);
}

if ($uri === '/api/admin/schemas' && $method === 'POST') {
	$payload = readJsonBody();
	$schemas = loadSchemas($storageFile);

	$schemaId = trim((string) ($payload['schema_id'] ?? ''));
	$name = trim((string) ($payload['name'] ?? ''));
	$tenantId = trim((string) ($payload['tenant_id'] ?? 'default')) ?: 'default';
	$fields = is_array($payload['fields'] ?? null) ? $payload['fields'] : [];
	$rules = is_array($payload['rules'] ?? null) ? $payload['rules'] : [];

	if ($schemaId === '' || $name === '') {
		respond(422, ['error' => 'schema_id and name are required.']);
	}

	if ($fields === []) {
		respond(422, ['error' => 'At least one field is required to save a schema.']);
	}

	foreach ($schemas as $schema) {
		if (($schema['schema_id'] ?? null) === $schemaId && ($schema['version'] ?? 1) === 1) {
			respond(409, ['error' => 'A schema with this schema_id already exists.']);
		}
	}

	$compiled = compileSchema($schemaId, 1, $tenantId, $fields, $rules);
	$now = gmdate(DATE_ATOM);

	$schema = [
		'id' => generateId(),
		'tenant_id' => $tenantId,
		'schema_id' => $schemaId,
		'name' => $name,
		'description' => (string) ($payload['description'] ?? ''),
		'version' => 1,
		'status' => 'draft',
		'fields' => array_values($fields),
		'rules' => array_values($rules),
		'compiled_graph' => $compiled['compiled_graph'],
		'metadata' => is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [],
		'data_sources' => is_array($payload['data_sources'] ?? null) ? $payload['data_sources'] : [],
		'global_rules' => is_array($payload['global_rules'] ?? null) ? $payload['global_rules'] : [],
		'dag_hash' => $compiled['dag_hash'],
		'signature' => null,
		'created_at' => $now,
		'updated_at' => $now,
		'published_at' => null,
	];

	$schemas[] = $schema;
	persistSchemas($storageFile, $schemas);

	respond(201, $schema);
}

if (preg_match('#^/api/admin/schemas/([^/]+)/publish$#', $uri, $matches) === 1 && $method === 'POST') {
	$id = urldecode($matches[1]);
	$schemas = loadSchemas($storageFile);
	$targetIndex = findSchemaIndexById($schemas, $id);

	if ($targetIndex === null) {
		respond(404, ['error' => 'Schema not found.']);
	}

	if (($schemas[$targetIndex]['status'] ?? '') !== 'draft') {
		respond(409, ['error' => 'Only draft schemas can be published.']);
	}

	foreach ($schemas as $index => $schema) {
		if (($schema['schema_id'] ?? null) === ($schemas[$targetIndex]['schema_id'] ?? null) && ($schema['status'] ?? null) === 'published') {
			$schemas[$index]['status'] = 'archived';
			$schemas[$index]['updated_at'] = gmdate(DATE_ATOM);
		}
	}

	$schemas[$targetIndex]['status'] = 'published';
	$schemas[$targetIndex]['signature'] = base64_encode(hash_hmac('sha256', (string) $schemas[$targetIndex]['dag_hash'], 'helix-preview-signing-key', true));
	$schemas[$targetIndex]['published_at'] = gmdate(DATE_ATOM);
	$schemas[$targetIndex]['updated_at'] = gmdate(DATE_ATOM);

	persistSchemas($storageFile, $schemas);
	respond(200, $schemas[$targetIndex]);
}

if (preg_match('#^/api/admin/schemas/([^/]+)/version$#', $uri, $matches) === 1 && $method === 'POST') {
	$schemaId = urldecode($matches[1]);
	$schemas = loadSchemas($storageFile);
	$latestPublished = findLatestPublishedSchema($schemas, $schemaId);

	if ($latestPublished === null) {
		respond(404, ['error' => 'Published schema not found.']);
	}

	$newVersion = ((int) $latestPublished['version']) + 1;
	$now = gmdate(DATE_ATOM);
	$draft = $latestPublished;
	$draft['id'] = generateId();
	$draft['version'] = $newVersion;
	$draft['status'] = 'draft';
	$draft['signature'] = null;
	$draft['published_at'] = null;
	$draft['created_at'] = $now;
	$draft['updated_at'] = $now;
	$draft['dag_hash'] = compileSchema(
		(string) $draft['schema_id'],
		$newVersion,
		(string) ($draft['tenant_id'] ?? 'default'),
		is_array($draft['fields'] ?? null) ? $draft['fields'] : [],
		is_array($draft['rules'] ?? null) ? $draft['rules'] : [],
	)['dag_hash'];

	$schemas[] = $draft;
	persistSchemas($storageFile, $schemas);
	respond(200, $draft);
}

if (preg_match('#^/api/admin/schemas/([^/]+)$#', $uri, $matches) === 1) {
	$key = urldecode($matches[1]);
	$schemas = loadSchemas($storageFile);

	if ($method === 'GET') {
		$version = isset($_GET['version']) ? (int) $_GET['version'] : null;
		$schema = findSchemaBySchemaId($schemas, $key, $version);

		if ($schema === null) {
			respond(404, ['error' => 'Schema not found.']);
		}

		respond(200, $schema);
	}

	if ($method === 'PUT') {
		$index = findSchemaIndexById($schemas, $key);
		if ($index === null) {
			respond(404, ['error' => 'Schema not found.']);
		}

		if (($schemas[$index]['status'] ?? '') !== 'draft') {
			respond(409, ['error' => 'Only draft schemas can be updated.']);
		}

		$payload = readJsonBody();
		$fields = is_array($payload['fields'] ?? null) ? $payload['fields'] : ($schemas[$index]['fields'] ?? []);
		if ($fields === []) {
			respond(422, ['error' => 'At least one field is required to save a schema.']);
		}

		$rules = is_array($payload['rules'] ?? null) ? $payload['rules'] : ($schemas[$index]['rules'] ?? []);
		$tenantId = trim((string) ($payload['tenant_id'] ?? $schemas[$index]['tenant_id'] ?? 'default')) ?: 'default';
		$compiled = compileSchema((string) $schemas[$index]['schema_id'], (int) $schemas[$index]['version'], $tenantId, $fields, $rules);

		$schemas[$index]['tenant_id'] = $tenantId;
		$schemas[$index]['name'] = trim((string) ($payload['name'] ?? $schemas[$index]['name'] ?? 'Untitled Form')) ?: 'Untitled Form';
		$schemas[$index]['description'] = (string) ($payload['description'] ?? $schemas[$index]['description'] ?? '');
		$schemas[$index]['fields'] = array_values($fields);
		$schemas[$index]['rules'] = array_values($rules);
		$schemas[$index]['compiled_graph'] = $compiled['compiled_graph'];
		$schemas[$index]['metadata'] = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : ($schemas[$index]['metadata'] ?? []);
		$schemas[$index]['data_sources'] = is_array($payload['data_sources'] ?? null) ? $payload['data_sources'] : ($schemas[$index]['data_sources'] ?? []);
		$schemas[$index]['global_rules'] = is_array($payload['global_rules'] ?? null) ? $payload['global_rules'] : ($schemas[$index]['global_rules'] ?? []);
		$schemas[$index]['dag_hash'] = $compiled['dag_hash'];
		$schemas[$index]['updated_at'] = gmdate(DATE_ATOM);

		persistSchemas($storageFile, $schemas);
		respond(200, $schemas[$index]);
	}

	if ($method === 'DELETE') {
		$index = findSchemaIndexById($schemas, $key);
		if ($index === null) {
			respond(404, ['error' => 'Schema not found.']);
		}

		if (($schemas[$index]['status'] ?? '') !== 'draft') {
			respond(409, ['error' => 'Only draft schemas can be deleted.']);
		}

		array_splice($schemas, $index, 1);
		persistSchemas($storageFile, $schemas);
		respond(200, ['message' => 'Schema deleted']);
	}
}

respond(404, [
	'error' => 'Route not found.',
	'method' => $method,
	'path' => $uri,
]);

function ensureStorage(string $storageFile): void
{
	$directory = dirname($storageFile);
	if (!is_dir($directory)) {
		mkdir($directory, 0777, true);
	}

	if (!is_file($storageFile)) {
		file_put_contents($storageFile, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
	}
}

function loadSchemas(string $storageFile): array
{
	$contents = file_get_contents($storageFile);
	if ($contents === false || trim($contents) === '') {
		return [];
	}

	$decoded = json_decode($contents, true);
	return is_array($decoded) ? $decoded : [];
}

function persistSchemas(string $storageFile, array $schemas): void
{
	file_put_contents($storageFile, json_encode(array_values($schemas), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function readJsonBody(): array
{
	$raw = file_get_contents('php://input');
	if ($raw === false || trim($raw) === '') {
		return [];
	}

	$decoded = json_decode($raw, true);
	return is_array($decoded) ? $decoded : [];
}

function respond(int $status, array $payload): void
{
	http_response_code($status);
	echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
	exit;
}

function generateId(): string
{
	return bin2hex(random_bytes(16));
}

function filterSchemas(array $schemas, array $filters): array
{
	return array_values(array_filter($schemas, static function (array $schema) use ($filters): bool {
		$tenantId = trim((string) ($filters['tenant_id'] ?? ''));
		$status = trim((string) ($filters['status'] ?? ''));
		$search = mb_strtolower(trim((string) ($filters['search'] ?? '')));

		if ($tenantId !== '' && (string) ($schema['tenant_id'] ?? '') !== $tenantId) {
			return false;
		}

		if ($status !== '' && (string) ($schema['status'] ?? '') !== $status) {
			return false;
		}

		if ($search !== '') {
			$haystack = mb_strtolower((string) (($schema['name'] ?? '') . ' ' . ($schema['schema_id'] ?? '')));
			if (!str_contains($haystack, $search)) {
				return false;
			}
		}

		return true;
	}));
}

function findSchemaIndexById(array $schemas, string $id): ?int
{
	foreach ($schemas as $index => $schema) {
		if ((string) ($schema['id'] ?? '') === $id) {
			return $index;
		}
	}

	return null;
}

function findSchemaBySchemaId(array $schemas, string $schemaId, ?int $version = null): ?array
{
	$matches = array_values(array_filter($schemas, static fn (array $schema): bool => (string) ($schema['schema_id'] ?? '') === $schemaId));
	if ($matches === []) {
		return null;
	}

	usort($matches, static fn (array $left, array $right): int => ((int) ($right['version'] ?? 0)) <=> ((int) ($left['version'] ?? 0)));

	if ($version !== null) {
		foreach ($matches as $schema) {
			if ((int) ($schema['version'] ?? 0) === $version) {
				return $schema;
			}
		}

		return null;
	}

	return $matches[0];
}

function findLatestPublishedSchema(array $schemas, string $schemaId): ?array
{
	$published = array_values(array_filter(
		$schemas,
		static fn (array $schema): bool => (string) ($schema['schema_id'] ?? '') === $schemaId && (string) ($schema['status'] ?? '') === 'published'
	));

	if ($published === []) {
		return null;
	}

	usort($published, static fn (array $left, array $right): int => ((int) ($right['version'] ?? 0)) <=> ((int) ($left['version'] ?? 0)));
	return $published[0];
}

function compileSchema(string $schemaId, int $version, string $tenantId, array $fields, array $rules): array
{
	$normalizedFields = [];
	foreach ($fields as $index => $field) {
		if (!is_array($field)) {
			continue;
		}

		$fieldId = trim((string) ($field['id'] ?? '')) ?: 'field_' . ($index + 1);
		$normalizedFields[$fieldId] = [
			'id' => $fieldId,
			'type' => (string) ($field['type'] ?? 'text'),
			'label' => (string) ($field['label'] ?? $fieldId),
			'required' => (bool) ($field['required'] ?? false),
			'placeholder' => (string) ($field['placeholder'] ?? ''),
			'default' => $field['defaultValue'] ?? ($field['default'] ?? null),
			'options' => is_array($field['options'] ?? null) ? array_values($field['options']) : [],
			'dataSource' => $field['dataSource'] ?? null,
		];
	}

	$normalizedRules = [];
	foreach ($rules as $index => $rule) {
		if (!is_array($rule)) {
			continue;
		}

		$normalizedRules[] = [
			'id' => (string) ($rule['id'] ?? ('rule_' . ($index + 1))),
			'dependsOn' => array_values(is_array($rule['dependsOn'] ?? null) ? $rule['dependsOn'] : []),
			'condition' => (string) ($rule['condition'] ?? 'true'),
			'actions' => array_values(is_array($rule['actions'] ?? null) ? $rule['actions'] : []),
			'priority' => (string) ($rule['priority'] ?? 'override'),
		];
	}

	$dagEvaluationOrder = array_keys($normalizedFields);
	$compiledGraph = [
		'fields' => $normalizedFields,
		'rules' => $normalizedRules,
		'constants' => [
			'tenant_id' => $tenantId,
		],
		'dag_evaluation_order' => $dagEvaluationOrder,
	];

	$dagHash = hash('sha256', json_encode([
		'schema_id' => $schemaId,
		'version' => $version,
		'compiled_graph' => $compiledGraph,
	], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

	return [
		'compiled_graph' => $compiledGraph,
		'dag_hash' => $dagHash,
	];
}

function fetchRemote(array $payload): array
{
	$method = strtoupper((string) ($payload['method'] ?? 'GET'));
	$headers = [
		'Content-Type: application/json',
	];

	foreach (($payload['headers'] ?? []) as $name => $value) {
		$headers[] = $name . ': ' . $value;
	}

	$context = stream_context_create([
		'http' => [
			'method' => $method,
			'header' => implode("\r\n", $headers),
			'content' => isset($payload['body']) ? json_encode($payload['body']) : null,
			'ignore_errors' => true,
			'timeout' => 10,
		],
	]);

	$body = @file_get_contents((string) $payload['url'], false, $context);
	$status = 200;
	if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches) === 1) {
		$status = (int) $matches[1];
	}

	$decoded = is_string($body) ? json_decode($body, true) : null;

	return [
		'status' => $status,
		'body' => [
			'success' => $status >= 200 && $status < 400,
			'status' => $status,
			'data' => $decoded ?? $body,
		],
	];
}
