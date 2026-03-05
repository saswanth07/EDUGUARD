package com.eduguardian.service;

import com.eduguardian.dto.ProctorEventDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Blockchain-inspired immutable event logger.
 * Each cheating event is stored as a block with a SHA-256 hash
 * linking to the previous block, creating a tamper-proof audit trail.
 */
@Service
@Slf4j
public class BlockchainService {

    private final List<Block> chain = new ArrayList<>();

    public BlockchainService() {
        // Genesis block
        chain.add(new Block(0, "0", "GENESIS", Instant.now()));
    }

    public String addBlock(ProctorEventDTO event) {
        Block previousBlock = chain.get(chain.size() - 1);
        String data = String.format("%d|%d|%s|%s|%.2f|%s",
                event.getExamId(),
                event.getStudentId(),
                event.getEventType(),
                event.getSeverity(),
                event.getConfidence() != null ? event.getConfidence() : 0.0,
                Instant.now()
        );

        Block newBlock = new Block(
                chain.size(),
                previousBlock.hash,
                data,
                Instant.now()
        );

        chain.add(newBlock);
        
        // Capping in-memory chain to prevent memory leaks during high-activity exams
        if (chain.size() > 1000) {
            chain.remove(1); // Keep genesis, remove oldest event
        }
        
        log.debug("Blockchain block #{} added: {}", newBlock.index, newBlock.hash.substring(0, 16));
        return newBlock.hash;
    }

    public boolean validateChain() {
        for (int i = 1; i < chain.size(); i++) {
            Block current = chain.get(i);
            Block previous = chain.get(i - 1);

            // Verify hash integrity
            String recalculatedHash = calculateHash(
                    current.index, current.previousHash, current.data, current.timestamp);
            if (!current.hash.equals(recalculatedHash)) {
                log.error("Blockchain integrity violation at block #{}", current.index);
                return false;
            }

            // Verify chain linkage
            if (!current.previousHash.equals(previous.hash)) {
                log.error("Blockchain linkage violation at block #{}", current.index);
                return false;
            }
        }
        return true;
    }

    public List<Block> getChain() {
        return new ArrayList<>(chain);
    }

    public int getChainLength() {
        return chain.size();
    }

    private static String calculateHash(int index, String previousHash, String data, Instant timestamp) {
        String input = index + previousHash + data + timestamp.toString();
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    public static class Block {
        public final int index;
        public final String previousHash;
        public final String data;
        public final Instant timestamp;
        public final String hash;

        public Block(int index, String previousHash, String data, Instant timestamp) {
            this.index = index;
            this.previousHash = previousHash;
            this.data = data;
            this.timestamp = timestamp;
            this.hash = calculateHash(index, previousHash, data, timestamp);
        }
    }
}
