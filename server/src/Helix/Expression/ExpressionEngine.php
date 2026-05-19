<?php
namespace Helix\Expression;

use Exception;

class ParseException extends Exception {}
class UndefinedVariableException extends Exception {}

class ExpressionEngine
{
    private array $tokens = [];
    private int $pos = 0;
    private array $context = [];
    private int $depth = 0;
    private const MAX_DEPTH = 100;

    public function evaluate(string $expression, array $context): mixed
    {
        $this->context = $context;
        $this->tokenize($expression);
        $this->pos = 0;
        
        if (empty($this->tokens)) {
            return null;
        }

        $result = $this->parseLogical();

        if ($this->pos < count($this->tokens)) {
            throw new ParseException("Unexpected token at end of expression: " . $this->tokens[$this->pos]['value']);
        }

        return $result;
    }

    private function tokenize(string $expression): void
    {
        $this->tokens = [];
        $length = strlen($expression);
        $i = 0;

        while ($i < $length) {
            $char = $expression[$i];

            if (ctype_space($char)) {
                $i++;
                continue;
            }

            // Operators
            if (substr($expression, $i, 3) === '===') { $this->tokens[] = ['type' => 'op', 'value' => '===']; $i += 3; continue; }
            if (substr($expression, $i, 3) === '!==') { $this->tokens[] = ['type' => 'op', 'value' => '!==']; $i += 3; continue; }
            if (substr($expression, $i, 2) === '>=') { $this->tokens[] = ['type' => 'op', 'value' => '>=']; $i += 2; continue; }
            if (substr($expression, $i, 2) === '<=') { $this->tokens[] = ['type' => 'op', 'value' => '<=']; $i += 2; continue; }
            if (substr($expression, $i, 2) === '&&') { $this->tokens[] = ['type' => 'op', 'value' => '&&']; $i += 2; continue; }
            if (substr($expression, $i, 2) === '||') { $this->tokens[] = ['type' => 'op', 'value' => '||']; $i += 2; continue; }
            if ($char === '>' || $char === '<') { $this->tokens[] = ['type' => 'op', 'value' => $char]; $i++; continue; }
            if ($char === '(' || $char === ')') { $this->tokens[] = ['type' => 'paren', 'value' => $char]; $i++; continue; }

            // Strings
            if ($char === "'" || $char === '"') {
                $quote = $char;
                $str = '';
                $i++;
                while ($i < $length && $expression[$i] !== $quote) {
                    $str .= $expression[$i++];
                }
                $i++; // skip closing quote
                $this->tokens[] = ['type' => 'literal', 'value' => $str];
                continue;
            }

            // Numbers
            if (ctype_digit($char)) {
                $num = '';
                while ($i < $length && (ctype_digit($expression[$i]) || $expression[$i] === '.')) {
                    $num .= $expression[$i++];
                }
                $this->tokens[] = ['type' => 'literal', 'value' => strpos($num, '.') !== false ? (float)$num : (int)$num];
                continue;
            }

            // Booleans, Null, and Variables
            if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*/', substr($expression, $i), $matches)) {
                $word = $matches[0];
                $i += strlen($word);
                if ($word === 'true') { $this->tokens[] = ['type' => 'literal', 'value' => true]; }
                elseif ($word === 'false') { $this->tokens[] = ['type' => 'literal', 'value' => false]; }
                elseif ($word === 'null') { $this->tokens[] = ['type' => 'literal', 'value' => null]; }
                else { $this->tokens[] = ['type' => 'variable', 'value' => $word]; }
                continue;
            }

            throw new ParseException("Unexpected character at index $i: $char");
        }
    }

    private function parseLogical(): mixed
    {
        if ($this->depth++ > self::MAX_DEPTH) {
            throw new ParseException("Maximum recursion depth exceeded");
        }
        try {
            $left = $this->parseComparison();

            while ($this->pos < count($this->tokens)) {
                $token = $this->tokens[$this->pos];
                if ($token['type'] === 'op' && ($token['value'] === '&&' || $token['value'] === '||')) {
                    $this->pos++;
                    $right = $this->parseComparison();
                    if ($token['value'] === '&&') {
                        $left = $left && $right;
                    } else {
                        $left = $left || $right;
                    }
                } else {
                    break;
                }
            }

            return $left;
        } finally {
            $this->depth--;
        }
    }

    private function parseComparison(): mixed
    {
        $left = $this->parseOperand();

        if ($this->pos < count($this->tokens)) {
            $token = $this->tokens[$this->pos];
            $ops = ['===', '!==', '>', '<', '>=', '<='];
            
            if ($token['type'] === 'op' && in_array($token['value'], $ops, true)) {
                $this->pos++;
                $right = $this->parseOperand();

                return match($token['value']) {
                    '===' => $left === $right,
                    '!==' => $left !== $right,
                    '>' => $left > $right,
                    '<' => $left < $right,
                    '>=' => $left >= $right,
                    '<=' => $left <= $right,
                };
            }
        }

        return $left;
    }

    private function parseOperand(): mixed
    {
        if ($this->pos >= count($this->tokens)) {
            throw new ParseException("Unexpected end of expression");
        }

        $token = $this->tokens[$this->pos++];

        if ($token['type'] === 'literal') {
            return $token['value'];
        }

        if ($token['type'] === 'variable') {
            $varName = $token['value'];
            if (!array_key_exists($varName, $this->context)) {
                return null; // Return null instead of strict throw for form context flexibility
            }
            return $this->context[$varName];
        }

        if ($token['type'] === 'paren' && $token['value'] === '(') {
            $expr = $this->parseLogical();
            if ($this->pos >= count($this->tokens) || $this->tokens[$this->pos]['value'] !== ')') {
                throw new ParseException("Missing closing parenthesis");
            }
            $this->pos++; // consume ')'
            return $expr;
        }

        throw new ParseException("Unexpected token: " . $token['value']);
    }
}
