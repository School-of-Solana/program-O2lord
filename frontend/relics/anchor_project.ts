/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/anchor_project.json`.
 */
export type AnchorProject = {
  "address": "CtvFQBDX6GdgDL5tS8spw7rZomT2ZwAxm6C9UaEe6hxo",
  "metadata": {
    "name": "anchorProject",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptContract",
      "discriminator": [
        217,
        254,
        164,
        16,
        244,
        59,
        30,
        81
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "payerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "trust_pay.payer",
                "account": "trustPay"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trustPay"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "deadlineDurationSeconds",
          "type": "u64"
        }
      ]
    },
    {
      "name": "approveMilestonePayment",
      "discriminator": [
        53,
        217,
        222,
        102,
        129,
        129,
        41,
        223
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "recipient",
          "writable": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trustPay"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "recipientTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeDestination",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "feeDestinationTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "feeDestination"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "milestoneIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "cancelContract",
      "discriminator": [
        3,
        168,
        37,
        73,
        140,
        194,
        156,
        165
      ],
      "accounts": [
        {
          "name": "canceller",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "recipient",
          "writable": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trustPay"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "cancellerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "canceller"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "createContract",
      "discriminator": [
        244,
        48,
        244,
        178,
        216,
        88,
        122,
        52
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "creatorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "payerPubkey"
              },
              {
                "kind": "arg",
                "path": "seed"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trustPay"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeDestination"
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": "u64"
        },
        {
          "name": "creatorRole",
          "type": "u8"
        },
        {
          "name": "payerPubkey",
          "type": "pubkey"
        },
        {
          "name": "otherParty",
          "type": "pubkey"
        },
        {
          "name": "contractType",
          "type": "u8"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "termsAndConditions",
          "type": "string"
        },
        {
          "name": "totalAmount",
          "type": "u64"
        },
        {
          "name": "milestoneInputs",
          "type": {
            "vec": {
              "defined": {
                "name": "milestoneInput"
              }
            }
          }
        },
        {
          "name": "deadlineDurationSeconds",
          "type": "u64"
        }
      ]
    },
    {
      "name": "declineContract",
      "discriminator": [
        229,
        120,
        200,
        154,
        125,
        221,
        227,
        105
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "recipient",
          "writable": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trustPay"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "recipientTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": []
    },
    {
      "name": "disputeContract",
      "discriminator": [
        233,
        27,
        189,
        199,
        113,
        14,
        171,
        147
      ],
      "accounts": [
        {
          "name": "disputer",
          "writable": true,
          "signer": true
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "trust_pay.payer",
                "account": "trustPay"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "milestoneIndex",
          "type": "u8"
        },
        {
          "name": "disputeReason",
          "type": "string"
        }
      ]
    },
    {
      "name": "markMilestoneComplete",
      "discriminator": [
        114,
        143,
        187,
        142,
        122,
        215,
        204,
        180
      ],
      "accounts": [
        {
          "name": "recipient",
          "writable": true,
          "signer": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "trust_pay.payer",
                "account": "trustPay"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "milestoneIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "resolver",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "recipient",
          "writable": true,
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "trustPay",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  117,
                  115,
                  116,
                  45,
                  112,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "trust_pay.seed",
                "account": "trustPay"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trustPay"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "payerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "recipientTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeDestination",
          "relations": [
            "trustPay"
          ]
        },
        {
          "name": "feeDestinationTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "feeDestination"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "milestoneIndex",
          "type": "u8"
        },
        {
          "name": "resolution",
          "type": "u8"
        },
        {
          "name": "resolutionReason",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalState",
      "discriminator": [
        163,
        46,
        74,
        168,
        216,
        123,
        133,
        98
      ]
    },
    {
      "name": "trustPay",
      "discriminator": [
        104,
        170,
        123,
        134,
        238,
        211,
        193,
        8
      ]
    }
  ],
  "events": [
    {
      "name": "contractAcceptedEvent",
      "discriminator": [
        44,
        179,
        64,
        120,
        80,
        175,
        210,
        187
      ]
    },
    {
      "name": "contractCancelledEvent",
      "discriminator": [
        76,
        25,
        235,
        145,
        63,
        105,
        115,
        13
      ]
    },
    {
      "name": "contractCompletedEvent",
      "discriminator": [
        238,
        230,
        41,
        137,
        75,
        119,
        51,
        38
      ]
    },
    {
      "name": "contractCreatedEvent",
      "discriminator": [
        31,
        162,
        233,
        14,
        63,
        40,
        221,
        168
      ]
    },
    {
      "name": "contractDeclinedEvent",
      "discriminator": [
        196,
        100,
        29,
        74,
        229,
        54,
        9,
        22
      ]
    },
    {
      "name": "disputeCreatedEvent",
      "discriminator": [
        89,
        162,
        48,
        158,
        30,
        116,
        145,
        247
      ]
    },
    {
      "name": "disputeResolvedEvent",
      "discriminator": [
        152,
        37,
        98,
        245,
        229,
        39,
        150,
        78
      ]
    },
    {
      "name": "milestoneApprovedEvent",
      "discriminator": [
        149,
        49,
        174,
        211,
        26,
        246,
        145,
        216
      ]
    },
    {
      "name": "milestoneCompletedEvent",
      "discriminator": [
        167,
        235,
        168,
        66,
        193,
        62,
        51,
        243
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "customError",
      "msg": "Custom error message"
    },
    {
      "code": 6001,
      "name": "invalidAmount",
      "msg": "Invalid amount specified."
    },
    {
      "code": 6002,
      "name": "titleTooLong",
      "msg": "Contract title is too long (max 100 characters)."
    },
    {
      "code": 6003,
      "name": "noMilestonesProvided",
      "msg": "No milestones provided for the contract."
    },
    {
      "code": 6004,
      "name": "tooManyMilestones",
      "msg": "Too many milestones (max 10 allowed)."
    },
    {
      "code": 6005,
      "name": "invalidDeadline",
      "msg": "Invalid deadline specified."
    },
    {
      "code": 6006,
      "name": "disputeResolutionTooLong",
      "msg": "Dispute resolution mechanism description is too long (max 200 characters)."
    },
    {
      "code": 6007,
      "name": "termsAndConditionsTooLong",
      "msg": "Dispute resolution mechanism description is too long (max 200 characters)."
    },
    {
      "code": 6008,
      "name": "contractNotAccepted",
      "msg": "Contract has not been accepted yet."
    },
    {
      "code": 6009,
      "name": "milestoneAmountMismatch",
      "msg": "Milestone amounts do not sum to total contract amount."
    },
    {
      "code": 6010,
      "name": "calculationError",
      "msg": "Calculation error occurred."
    },
    {
      "code": 6011,
      "name": "contractNotPending",
      "msg": "Contract is not in pending status."
    },
    {
      "code": 6012,
      "name": "contractExpired",
      "msg": "Contract has expired."
    },
    {
      "code": 6013,
      "name": "contractNotInProgress",
      "msg": "Contract is not in progress."
    },
    {
      "code": 6014,
      "name": "contractNotDisputed",
      "msg": "Contract is not in disputed status."
    },
    {
      "code": 6015,
      "name": "invalidMilestoneIndex",
      "msg": "Invalid milestone index."
    },
    {
      "code": 6016,
      "name": "milestoneNotPending",
      "msg": "Milestone is not in pending status."
    },
    {
      "code": 6017,
      "name": "milestoneNotCompleted",
      "msg": "Milestone is not completed by service provider."
    },
    {
      "code": 6018,
      "name": "milestoneNotDisputable",
      "msg": "Milestone is not disputable."
    },
    {
      "code": 6019,
      "name": "milestoneNotDisputed",
      "msg": "Milestone is not in disputed status."
    },
    {
      "code": 6020,
      "name": "invalidDisputeReason",
      "msg": "Invalid dispute reason."
    },
    {
      "code": 6021,
      "name": "invalidResolution",
      "msg": "Invalid resolution value."
    },
    {
      "code": 6022,
      "name": "deadlineTooFar",
      "msg": "Deadlin is too far."
    },
    {
      "code": 6023,
      "name": "unauthorized",
      "msg": "You are not authorized to perform this action."
    },
    {
      "code": 6024,
      "name": "unauthorizedDisputer",
      "msg": "Only the payer or recipient can dispute a milestone."
    },
    {
      "code": 6025,
      "name": "unauthorizedResolver",
      "msg": "Only an authorized resolver can resolve a dispute."
    },
    {
      "code": 6026,
      "name": "invalidRole",
      "msg": "Invalid role specified. Must be 0 (payer) or 1 (recipient)."
    },
    {
      "code": 6027,
      "name": "invalidContractType",
      "msg": "Invalid contract type. Must be 0 (one-time payment) or 1 (milestone payment)."
    },
    {
      "code": 6028,
      "name": "payerMismatch",
      "msg": "Payer Mismatch"
    }
  ],
  "types": [
    {
      "name": "contractAcceptedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          },
          {
            "name": "acceptedAt",
            "type": "i64"
          },
          {
            "name": "deadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "contractCancelledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "canceller",
            "type": "pubkey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "refundedAmount",
            "type": "u64"
          },
          {
            "name": "cancelledAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "contractCompletedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "contractCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "feePercentage",
            "type": "u16"
          },
          {
            "name": "feeDestination",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "contractDeclinedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "refundedAmount",
            "type": "u64"
          },
          {
            "name": "declinedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "milestoneIndex",
            "type": "u8"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "disputer",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "disputeId",
            "type": "string"
          },
          {
            "name": "disputedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeResolvedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "milestoneIndex",
            "type": "u8"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "resolution",
            "type": "u8"
          },
          {
            "name": "resolutionReason",
            "type": "string"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalTrustPayCreated",
            "type": "u64"
          },
          {
            "name": "totalTrustPayClosed",
            "type": "u64"
          },
          {
            "name": "totalConfirmations",
            "type": "u64"
          },
          {
            "name": "feePercentage",
            "type": "u16"
          },
          {
            "name": "feeDestination",
            "type": "pubkey"
          },
          {
            "name": "totalFeesCollected",
            "type": "u64"
          },
          {
            "name": "totalDisputes",
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "type": "u64"
          },
          {
            "name": "tokenDecimals",
            "type": "u8"
          },
          {
            "name": "highWatermarkVolume",
            "type": "u64"
          },
          {
            "name": "lastVolumeUpdate",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "milestone",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "completedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "approvedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "disputeReason",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "disputeId",
            "type": {
              "option": "string"
            }
          }
        ]
      }
    },
    {
      "name": "milestoneApprovedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "milestoneIndex",
            "type": "u8"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "approvedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "milestoneCompletedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trustPay",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "milestoneIndex",
            "type": "u8"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "milestoneInput",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "trustPay",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contractType",
            "type": "u8"
          },
          {
            "name": "seed",
            "type": "u64"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "termsAndConditions",
            "type": "string"
          },
          {
            "name": "totalContractAmount",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "acceptanceTimestamp",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "contractStatus",
            "type": "u8"
          },
          {
            "name": "feePercentage",
            "type": "u16"
          },
          {
            "name": "feeDestination",
            "type": "pubkey"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "milestones",
            "type": {
              "vec": {
                "defined": {
                  "name": "milestone"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
