<?php

class PaymentConfirmationService
{
    private $database;

    public function __construct(PDO $database)
    {
        $this->database = $database;
    }

    public function confirmPayment(string $requestId, string $reference, int $amountPaid, string $status): bool
    {
        $sql = "UPDATE service_requests SET payment_reference = :reference, payment_amount = :amountPaid, status = :status, updated_at = NOW() WHERE id = :requestId";
        $statement = $this->database->prepare($sql);
        return $statement->execute([
            ':reference' => $reference,
            ':amountPaid' => $amountPaid,
            ':status' => $status,
            ':requestId' => $requestId,
        ]);
    }

    public function setPaymentMetadata(string $requestId, array $metadata): bool
    {
        $fields = [];
        $params = [':requestId' => $requestId];

        if (isset($metadata['amount_due'])) {
            $fields[] = 'amount_due = :amount_due';
            $params[':amount_due'] = $metadata['amount_due'];
        }

        if (isset($metadata['paid_at'])) {
            $fields[] = 'paid_at = :paid_at';
            $params[':paid_at'] = $metadata['paid_at'];
        }

        if (empty($fields)) {
            return false;
        }

        $sql = sprintf(
            'UPDATE service_requests SET %s, updated_at = NOW() WHERE id = :requestId',
            implode(', ', $fields)
        );

        $statement = $this->database->prepare($sql);
        return $statement->execute($params);
    }
}
