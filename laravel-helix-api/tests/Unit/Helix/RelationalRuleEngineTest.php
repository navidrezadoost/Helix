<?php

namespace Tests\Unit\Helix;

use PHPUnit\Framework\TestCase;
use App\Services\Helix\RelationalRuleEngine;

class RelationalRuleEngineTest extends TestCase
{
    private RelationalRuleEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new RelationalRuleEngine();
    }

    public function test_evaluates_complex_cascading_dependencies()
    {
        // A complex configuration DAG
        // Evaluates: country -> region -> shipping_method -> physical_address -> insurance
        $compiledGraph = [
            'dag_evaluation_order' => [
                'country',
                'region',
                'shipping_method',
                'physical_address',
                'insurance'
            ],
            'fields' => [
                'country' => ['required' => true],
                'region' => [
                    'conditions' => [
                        'visible' => ['field' => 'country', 'operator' => '===', 'value' => 'US'],
                        'required' => ['field' => 'country', 'operator' => '===', 'value' => 'US']
                    ]
                ],
                'shipping_method' => [
                    'conditions' => [
                        'visible' => ['field' => 'country', 'operator' => '!==', 'value' => ''],
                    ]
                ],
                'physical_address' => [
                    'conditions' => [
                        'visible' => ['field' => 'shipping_method', 'operator' => '===', 'value' => 'freight'],
                        'required' => ['field' => 'shipping_method', 'operator' => '===', 'value' => 'freight'],
                    ]
                ],
                'insurance' => [
                    'conditions' => [
                        // Imagine 'insurance' is only offered if shipping is freight and item value is large,
                        // For simplicity in current operator support, we chain it by just needing 'physical_address' presence conceptually,
                        // or checking evaluating 'shipping_method' directly.
                        'visible' => ['field' => 'shipping_method', 'operator' => '===', 'value' => 'freight']
                    ]
                ]
            ]
        ];

        // Scenario 1: Canada (Region hidden, Shipping visible)
        $data1 = ['country' => 'CA', 'shipping_method' => 'air'];
        $result1 = $this->engine->evaluate($compiledGraph, $data1);

        $this->assertTrue($result1['country']['visible']);
        $this->assertFalse($result1['region']['visible']);
        $this->assertFalse($result1['region']['required']);
        $this->assertTrue($result1['shipping_method']['visible']);
        $this->assertFalse($result1['physical_address']['visible']);

        // Scenario 2: US, Standard Shipping (Region visible, Physical address hidden)
        $data2 = ['country' => 'US', 'region' => 'CA', 'shipping_method' => 'standard'];
        $result2 = $this->engine->evaluate($compiledGraph, $data2);

        $this->assertTrue($result2['region']['visible']);
        $this->assertTrue($result2['region']['required']);
        $this->assertTrue($result2['shipping_method']['visible']);
        $this->assertFalse($result2['physical_address']['visible']);
        
        // Scenario 3: US, Freight Shipping (Region visible, Physical address visible + required, Insurance visible)
        $data3 = ['country' => 'US', 'region' => 'NY', 'shipping_method' => 'freight'];
        $result3 = $this->engine->evaluate($compiledGraph, $data3);

        $this->assertTrue($result3['physical_address']['visible']);
        $this->assertTrue($result3['physical_address']['required']);
        $this->assertTrue($result3['insurance']['visible']);
    }

    public function test_numeric_bounds_conditions_in_dag()
    {
        $compiledGraph = [
            'dag_evaluation_order' => ['age', 'senior_discount', 'youth_pass'],
            'fields' => [
                'age' => ['type' => 'number'],
                'senior_discount' => [
                    'conditions' => [
                        'visible' => ['field' => 'age', 'operator' => '>', 'value' => 64]
                    ]
                ],
                'youth_pass' => [
                    'conditions' => [
                        'visible' => ['field' => 'age', 'operator' => '<', 'value' => 18]
                    ]
                ]
            ]
        ];

        // Senior scenario
        $result1 = $this->engine->evaluate($compiledGraph, ['age' => 70]);
        $this->assertTrue($result1['senior_discount']['visible']);
        $this->assertFalse($result1['youth_pass']['visible']);

        // Youth scenario
        $result2 = $this->engine->evaluate($compiledGraph, ['age' => 16]);
        $this->assertFalse($result2['senior_discount']['visible']);
        $this->assertTrue($result2['youth_pass']['visible']);

        // Adult scenario
        $result3 = $this->engine->evaluate($compiledGraph, ['age' => 35]);
        $this->assertFalse($result3['senior_discount']['visible']);
        $this->assertFalse($result3['youth_pass']['visible']);
    }
}
