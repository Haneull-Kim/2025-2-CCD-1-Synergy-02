package com.synergy.bokja.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "user_medicine_table")
public class UserMedicineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long umno;

    @Column(nullable = false)
    private Long uno;

    @Column(nullable = false, length = 20)
    private String category;

    @Column(nullable = false)
    private String hospital;

    @Column(nullable = false)
    private int taken;

    @Column(nullable = false)
    private Long acno;

    @Column(nullable = false)
    private java.sql.Timestamp created_at;
}
