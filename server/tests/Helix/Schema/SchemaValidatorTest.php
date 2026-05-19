<?php
namespace Helix\Schema;

use PHPUnit\Framework\TestCase;
use Helix\Schema\Exceptions\SchemaValidationException;
use Helix\Schema\Exceptions\CycleDetectedException;

class SchemaValidatorTest extends TestCase
{
    private SchemaValidator $validator;

    protected function setUp(): void
    {
        $this->validator = new SchemaValidator();
    }

    public function testValidSchemaCompiles(): void
    {
        $rawSchema = [
            'schema_id' => 'product-config-v2',
            'version' => 3,
            'fields' => [
                'has_discount' => ['type' => 'boolean', 'required' => true],
                'discount_amount' => ['type' => 'number', 'required' => false, 'min' => 0, 'max' => 100],
                'customer_email' => ['type' => 'string', 'pattern' => '/^[^@]+@[^@]+\.[^@]+$/'],
            ],
            'rules' => [
                [
                    'depends_on' => ['has_discount'],
                    'condition' => 'has_discount === true',
                    'actions' => [
                        ['type' => 'setRequired', 'field' => 'discount_amount', 'required' => true],
                        ['type' => 'show', 'field' => 'discount_amount'],
                    ]
                ]
            ],
            'constants' => ['tenant_id' => '...', 'shop_domain' => '...']
        ];

        $compiled = $this->validator->validate($rawSchema);

        $this->assertInstanceOf(CompiledGraph::class, $compiled);
        $this->assertEquals('product-config-v2', $compiled->schemaId);
        $this->assertEquals(3, $compiled->version);
        $this->assertCount(3, $compiled->dagEvaluationOrder);
    }

    public function testCycleDetectionThrowsException(): void
    {
        $rawSchema = [
            'schema_id' => 'cycle-test',
            'version' => 1,
            'fields' => [
                'field_a' => ['type' => 'string'],
                'field_b' => ['type' => 'string'],
            ],
            'rules' => [
                [
                    'depends_on' => ['field_b'],
                    'condition' => 'true',
                    'actions' => [
                        ['type' => 'show', 'field' => 'field_a']
                    ]
                ],
                [
                    'depends_on' => ['field_a'],
                    'condition' => 'true',
                    'actions' => [
                        ['type' => 'show', 'field' => 'field_b']
                    ]
                ]
            ]
        ];

        $this->expectException(CycleDetectedException::class);
        $this->expectExceptionMessage('Cycle detected');
        $this->validator->validate($rawSchema);
    }

    public function testMissingFieldThrowsException(): void
    {
        $rawSchema = [
            'schema_id' => 'missing-field-test',
            'version' => 1,
            'fields' => [
                'field_a' => ['type' => 'string'],
            ],
            'rules' => [
                [
                    'depends_on' => ['field_b'], // field_b doesn't exist
                    'condition' => 'true',
                    'actions' => [
                        ['type' => 'show', 'field' => 'field_a']
                    ]
                ]
            ]
        ];

        $this->expectException(SchemaValidationException::class);
        $this->expectExceptionMessage("Rule depends_on references an unknown field: 'field_b'.");
        $this->validator->validate($rawSchema);
    }

    public function testHashIsDeterministic(): void
    {
        $schema1 = [
            'schema_id' => 'hash-test',
            'version' => 1,
            'fields' => [
                'a' => ['type' => 'string'],
                'b' => ['type' => 'number'],
            ]
        ];

        // Same schema, different order of keys
        $schema2 = [
            'version' => 1,
            'schema_id' => 'hash-test',
            'fields' => [
                'b' => ['type' => 'number'],
                'a' => ['type' => 'string'],
            ]
        ];

        $compiled1 = $this->validator->validate($schema1);
        $compiled2 = $this->validator->validate($schema2);

        $this->assertEquals($compiled1->dagHash, $compiled2->dagHash);
    }

    public function testTopologicalSortReturnsCorrectOrder(): void
    {
        $dependencies = [
            'field_a' => [],
            'field_b' => ['field_a'], // b depends on a
            'field_c' => ['field_b']  // c depends on b
        ];
        
        $sorted = $this->validator->topologicalSort($dependencies);
        
        // A must come before B, B must come before C.
        $indexA = array_search('field_a', $sorted);
        $indexB = array_search('field_b', $sorted);
        $indexC = array_search('field_c', $sorted);

        $this->assertLessThan($indexB, $indexA);
        $this->assertLessThan($indexC, $indexB);
    }
}
