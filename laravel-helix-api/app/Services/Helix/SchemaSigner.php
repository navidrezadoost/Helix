<?php

namespace App\Services\Helix;

use RuntimeException;

class SchemaSigner
{
    public function sign(string $dagHash): string
    {
        $privateKey = $this->resolvePrivateKey(config('services.helix.private_key'));

        if (is_resource($privateKey) || $privateKey instanceof \OpenSSLAsymmetricKey) {
            $signature = '';
            $result = openssl_sign($dagHash, $signature, $privateKey, 'Ed25519');
            if ($result !== true) {
                throw new RuntimeException('Unable to sign schema hash with configured Ed25519 key.');
            }

            return base64_encode($signature);
        }

        $signature = sodium_crypto_sign_detached($dagHash, $privateKey);
        return sodium_bin2base64($signature, SODIUM_BASE64_VARIANT_ORIGINAL);
    }

    public function verify(string $dagHash, string $signatureBase64, string $publicKeyValue): bool
    {
        $signature = base64_decode($signatureBase64, true);
        if ($signature === false) {
            return false;
        }

        $publicKey = $this->resolvePublicKey($publicKeyValue);

        if (is_resource($publicKey) || $publicKey instanceof \OpenSSLAsymmetricKey) {
            return openssl_verify($dagHash, $signature, $publicKey, 'Ed25519') === 1;
        }

        return sodium_crypto_sign_verify_detached($signature, $dagHash, $publicKey);
    }

    private function resolvePrivateKey(?string $configuredKey): mixed
    {
        if (!$configuredKey) {
            throw new RuntimeException('HELIX_PRIVATE_KEY not configured.');
        }

        $decoded = base64_decode($configuredKey, true);
        $candidate = $decoded !== false ? $decoded : $configuredKey;

        if (str_contains($candidate, 'BEGIN')) {
            $key = openssl_pkey_get_private($candidate);
            if ($key === false) {
                throw new RuntimeException('Configured HELIX_PRIVATE_KEY could not be parsed.');
            }

            return $key;
        }

        return sodium_base642bin($configuredKey, SODIUM_BASE64_VARIANT_ORIGINAL);
    }

    private function resolvePublicKey(?string $configuredKey): mixed
    {
        if (!$configuredKey) {
            throw new RuntimeException('HELIX_PUBLIC_KEY not configured.');
        }

        $decoded = base64_decode($configuredKey, true);
        $candidate = $decoded !== false ? $decoded : $configuredKey;

        if (str_contains($candidate, 'BEGIN')) {
            $key = openssl_pkey_get_public($candidate);
            if ($key === false) {
                throw new RuntimeException('Configured HELIX_PUBLIC_KEY could not be parsed.');
            }

            return $key;
        }

        return sodium_base642bin($configuredKey, SODIUM_BASE64_VARIANT_ORIGINAL);
    }
}
