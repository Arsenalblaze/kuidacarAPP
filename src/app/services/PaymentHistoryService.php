<?php

class PaymentHistoryService
{
    private $database;

    public function __construct(PDO $database)
    {
        $this->database = $database;
    }

    public function fetchRecentPayments(int $limit = 50): array
    {
        $sql = 'SELECT id, request_id, payment_reference, payment_amount, status, updated_at FROM service_requests ORDER BY updated_at DESC LIMIT :limit';
        $statement = $this->database->prepare($sql);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function fetchPaymentHistoryByReference(string $reference): array
    {
        $sql = 'SELECT id, request_id, payment_reference, payment_amount, status, updated_at FROM service_requests WHERE payment_reference = :reference ORDER BY updated_at DESC';
        $statement = $this->database->prepare($sql);
        $statement->execute([':reference' => $reference]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }
}
