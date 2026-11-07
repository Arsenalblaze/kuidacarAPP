<?php

class NotificationService
{
    private $database;

    public function __construct(PDO $database)
    {
        $this->database = $database;
    }

    public function createNotification(array $payload): bool
    {
        $sql = "INSERT INTO notifications (user_id, request_id, type, title, message, payload, status, created_at, updated_at) VALUES (:user_id, :request_id, :type, :title, :message, :payload, :status, NOW(), NOW())";
        $statement = $this->database->prepare($sql);
        return $statement->execute([
            ':user_id' => $payload['userId'] ?? null,
            ':request_id' => $payload['requestId'] ?? null,
            ':type' => $payload['type'] ?? 'payment_confirmed',
            ':title' => $payload['title'] ?? '',
            ':message' => $payload['message'] ?? '',
            ':payload' => json_encode($payload['payload'] ?? []),
            ':status' => $payload['status'] ?? 'unread',
        ]);
    }
}
