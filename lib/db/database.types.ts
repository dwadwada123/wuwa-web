
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "abilities": {
                  Row: {
                    "ability_category": string,"ability_code": string,"created_at": string,"id": string,"resonator_id": string
                  }
                  Insert: {
                    "ability_category": string,"ability_code": string,"created_at"?: string,"id"?: string,"resonator_id": string
                  }
                  Update: {
                    "ability_category"?: string,"ability_code"?: string,"created_at"?: string,"id"?: string,"resonator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "abilities_resonator_id_fkey"
      columns: ["resonator_id"]
isOneToOne: false
      referencedRelation: "resonators"
      referencedColumns: ["id"]
    }
                  ]
                },"ability_effects": {
                  Row: {
                    "ability_patch_id": string,"effect_id": string,"effect_order": number,"id": string,"patch_id": string
                  }
                  Insert: {
                    "ability_patch_id": string,"effect_id": string,"effect_order"?: number,"id"?: string,"patch_id": string
                  }
                  Update: {
                    "ability_patch_id"?: string,"effect_id"?: string,"effect_order"?: number,"id"?: string,"patch_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ability_effects_ability_patch_fkey"
      columns: ["ability_patch_id","patch_id"]
isOneToOne: false
      referencedRelation: "ability_patch_data"
      referencedColumns: ["id","patch_id"]
    },{
      foreignKeyName: "ability_effects_gameplay_effect_fkey"
      columns: ["effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    },{
      foreignKeyName: "ability_effects_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    }
                  ]
                },"ability_patch_data": {
                  Row: {
                    "ability_id": string,"concertos_generated": number,"cooldown_seconds": number | null,"created_at": string,"description": string | null,"energy_cost": number | null,"id": string,"name": string,"patch_id": string,"provenance_id": string | null,"status": string
                  }
                  Insert: {
                    "ability_id": string,"concertos_generated"?: number,"cooldown_seconds"?: number | null,"created_at"?: string,"description"?: string | null,"energy_cost"?: number | null,"id"?: string,"name": string,"patch_id": string,"provenance_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "ability_id"?: string,"concertos_generated"?: number,"cooldown_seconds"?: number | null,"created_at"?: string,"description"?: string | null,"energy_cost"?: number | null,"id"?: string,"name"?: string,"patch_id"?: string,"provenance_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ability_patch_data_ability_id_fkey"
      columns: ["ability_id"]
isOneToOne: false
      referencedRelation: "abilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ability_patch_data_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ability_patch_data_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"area_effects": {
                  Row: {
                    "created_at": string,"description": string,"effect_id": string,"id": string,"name": string,"patch_id": string
                  }
                  Insert: {
                    "created_at"?: string,"description": string,"effect_id": string,"id"?: string,"name": string,"patch_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"effect_id"?: string,"id"?: string,"name"?: string,"patch_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "area_effects_gameplay_effect_fkey"
      columns: ["effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    },{
      foreignKeyName: "area_effects_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    }
                  ]
                },"challenge_goals": {
                  Row: {
                    "created_at": string,"goal_order": number,"id": string,"patch_id": string,"points": number,"stage_id": string,"target_time_seconds": number
                  }
                  Insert: {
                    "created_at"?: string,"goal_order"?: number,"id"?: string,"patch_id": string,"points"?: number,"stage_id": string,"target_time_seconds": number
                  }
                  Update: {
                    "created_at"?: string,"goal_order"?: number,"id"?: string,"patch_id"?: string,"points"?: number,"stage_id"?: string,"target_time_seconds"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_goals_stage_fkey"
      columns: ["stage_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_stages"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"combat_tags": {
                  Row: {
                    "code": string,"description": string | null,"id": string,"label": string
                  }
                  Insert: {
                    "code": string,"description"?: string | null,"id"?: string,"label": string
                  }
                  Update: {
                    "code"?: string,"description"?: string | null,"id"?: string,"label"?: string
                  }
                  Relationships: [
                    
                  ]
                },"echo_patch_data": {
                  Row: {
                    "cd_seconds": number,"concertos_generated": number,"cost": number,"created_at": string,"echo_id": string,"id": string,"patch_id": string,"provenance_id": string | null,"skill_effect_id": string | null
                  }
                  Insert: {
                    "cd_seconds"?: number,"concertos_generated"?: number,"cost": number,"created_at"?: string,"echo_id": string,"id"?: string,"patch_id": string,"provenance_id"?: string | null,"skill_effect_id"?: string | null
                  }
                  Update: {
                    "cd_seconds"?: number,"concertos_generated"?: number,"cost"?: number,"created_at"?: string,"echo_id"?: string,"id"?: string,"patch_id"?: string,"provenance_id"?: string | null,"skill_effect_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "echo_patch_data_echo_id_fkey"
      columns: ["echo_id"]
isOneToOne: false
      referencedRelation: "echoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "echo_patch_data_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "echo_patch_data_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "echo_patch_effect_fkey"
      columns: ["skill_effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"echoes": {
                  Row: {
                    "class_type": string,"cost": number,"created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "class_type": string,"cost": number,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "class_type"?: string,"cost"?: number,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enemies": {
                  Row: {
                    "code": string,"created_at": string,"enemy_class": string,"id": string,"name": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"enemy_class": string,"id"?: string,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"enemy_class"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enemy_modifiers": {
                  Row: {
                    "created_at": string,"enemy_id": string,"id": string,"is_active": boolean,"modifier_type": string,"parameters": NonNullable<Json>,"patch_id": string,"provenance_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"enemy_id": string,"id"?: string,"is_active"?: boolean,"modifier_type": string,"parameters"?: NonNullable<Json>,"patch_id": string,"provenance_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"enemy_id"?: string,"id"?: string,"is_active"?: boolean,"modifier_type"?: string,"parameters"?: NonNullable<Json>,"patch_id"?: string,"provenance_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "enemy_modifiers_enemy_id_fkey"
      columns: ["enemy_id"]
isOneToOne: false
      referencedRelation: "enemies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enemy_modifiers_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enemy_modifiers_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"enemy_resistances": {
                  Row: {
                    "created_at": string,"element": string,"enemy_id": string,"id": string,"patch_id": string,"provenance_id": string | null,"resistance_ratio": number
                  }
                  Insert: {
                    "created_at"?: string,"element": string,"enemy_id": string,"id"?: string,"patch_id": string,"provenance_id"?: string | null,"resistance_ratio": number
                  }
                  Update: {
                    "created_at"?: string,"element"?: string,"enemy_id"?: string,"id"?: string,"patch_id"?: string,"provenance_id"?: string | null,"resistance_ratio"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "enemy_resistances_enemy_id_fkey"
      columns: ["enemy_id"]
isOneToOne: false
      referencedRelation: "enemies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enemy_resistances_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enemy_resistances_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"functional_roles": {
                  Row: {
                    "code": string,"description": string | null,"id": string,"label": string
                  }
                  Insert: {
                    "code": string,"description"?: string | null,"id"?: string,"label": string
                  }
                  Update: {
                    "code"?: string,"description"?: string | null,"id"?: string,"label"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gameplay_effects": {
                  Row: {
                    "category": string,"condition_expression": NonNullable<Json>,"created_at": string,"detail_expression": NonNullable<Json>,"id": string,"patch_id": string,"provenance_id": string | null,"target": string
                  }
                  Insert: {
                    "category": string,"condition_expression"?: NonNullable<Json>,"created_at"?: string,"detail_expression"?: NonNullable<Json>,"id"?: string,"patch_id": string,"provenance_id"?: string | null,"target": string
                  }
                  Update: {
                    "category"?: string,"condition_expression"?: NonNullable<Json>,"created_at"?: string,"detail_expression"?: NonNullable<Json>,"id"?: string,"patch_id"?: string,"provenance_id"?: string | null,"target"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gameplay_effects_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gameplay_effects_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"patches": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"release_date": string,"version": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"release_date": string,"version": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"release_date"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"provenance_sources": {
                  Row: {
                    "classification": string,"confidence": string,"created_at": string,"id": string,"source_name": string,"source_type": string,"status": string,"url": string | null,"verification_date": string
                  }
                  Insert: {
                    "classification": string,"confidence": string,"created_at"?: string,"id"?: string,"source_name": string,"source_type": string,"status"?: string,"url"?: string | null,"verification_date": string
                  }
                  Update: {
                    "classification"?: string,"confidence"?: string,"created_at"?: string,"id"?: string,"source_name"?: string,"source_type"?: string,"status"?: string,"url"?: string | null,"verification_date"?: string
                  }
                  Relationships: [
                    
                  ]
                },"resonator_combat_tags": {
                  Row: {
                    "resonator_patch_id": string,"tag_id": string
                  }
                  Insert: {
                    "resonator_patch_id": string,"tag_id": string
                  }
                  Update: {
                    "resonator_patch_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resonator_combat_tags_resonator_patch_id_fkey"
      columns: ["resonator_patch_id"]
isOneToOne: false
      referencedRelation: "resonator_patch_data"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_combat_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "combat_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"resonator_patch_data": {
                  Row: {
                    "base_atk_lvl90": number,"base_def_lvl90": number,"base_hp_lvl90": number,"created_at": string,"id": string,"patch_id": string,"provenance_id": string | null,"resonator_id": string
                  }
                  Insert: {
                    "base_atk_lvl90": number,"base_def_lvl90": number,"base_hp_lvl90": number,"created_at"?: string,"id"?: string,"patch_id": string,"provenance_id"?: string | null,"resonator_id": string
                  }
                  Update: {
                    "base_atk_lvl90"?: number,"base_def_lvl90"?: number,"base_hp_lvl90"?: number,"created_at"?: string,"id"?: string,"patch_id"?: string,"provenance_id"?: string | null,"resonator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resonator_patch_data_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_patch_data_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_patch_data_resonator_id_fkey"
      columns: ["resonator_id"]
isOneToOne: false
      referencedRelation: "resonators"
      referencedColumns: ["id"]
    }
                  ]
                },"resonator_roles": {
                  Row: {
                    "is_primary": boolean,"resonator_patch_id": string,"role_id": string
                  }
                  Insert: {
                    "is_primary"?: boolean,"resonator_patch_id": string,"role_id": string
                  }
                  Update: {
                    "is_primary"?: boolean,"resonator_patch_id"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resonator_roles_resonator_patch_id_fkey"
      columns: ["resonator_patch_id"]
isOneToOne: false
      referencedRelation: "resonator_patch_data"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "functional_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"resonator_sequence_effects": {
                  Row: {
                    "effect_id": string,"effect_order": number,"id": string,"patch_id": string,"sequence_patch_id": string
                  }
                  Insert: {
                    "effect_id": string,"effect_order"?: number,"id"?: string,"patch_id": string,"sequence_patch_id": string
                  }
                  Update: {
                    "effect_id"?: string,"effect_order"?: number,"id"?: string,"patch_id"?: string,"sequence_patch_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resonator_sequence_effects_gameplay_effect_fkey"
      columns: ["effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    },{
      foreignKeyName: "resonator_sequence_effects_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_sequence_effects_sequence_patch_fkey"
      columns: ["sequence_patch_id","patch_id"]
isOneToOne: false
      referencedRelation: "resonator_sequence_patch_data"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"resonator_sequence_patch_data": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"name": string,"patch_id": string,"provenance_id": string | null,"sequence_id": string
                  }
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"name": string,"patch_id": string,"provenance_id"?: string | null,"sequence_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"patch_id"?: string,"provenance_id"?: string | null,"sequence_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resonator_sequence_patch_data_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_sequence_patch_data_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resonator_sequence_patch_data_sequence_id_fkey"
      columns: ["sequence_id"]
isOneToOne: false
      referencedRelation: "resonator_sequences"
      referencedColumns: ["id"]
    }
                  ]
                },"resonator_sequences": {
                  Row: {
                    "created_at": string,"id": string,"node_code": string,"node_order": number,"resonator_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"node_code": string,"node_order": number,"resonator_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"node_code"?: string,"node_order"?: number,"resonator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resonator_sequences_resonator_id_fkey"
      columns: ["resonator_id"]
isOneToOne: false
      referencedRelation: "resonators"
      referencedColumns: ["id"]
    }
                  ]
                },"resonators": {
                  Row: {
                    "created_at": string,"element": string,"id": string,"name": string,"rarity": number,"release_date": string,"weapon_type": string
                  }
                  Insert: {
                    "created_at"?: string,"element": string,"id"?: string,"name": string,"rarity": number,"release_date": string,"weapon_type": string
                  }
                  Update: {
                    "created_at"?: string,"element"?: string,"id"?: string,"name"?: string,"rarity"?: number,"release_date"?: string,"weapon_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sonata_patch_data": {
                  Row: {
                    "created_at": string,"five_piece_effect_id": string,"id": string,"patch_id": string,"provenance_id": string | null,"sonata_id": string,"two_piece_effect_id": string
                  }
                  Insert: {
                    "created_at"?: string,"five_piece_effect_id": string,"id"?: string,"patch_id": string,"provenance_id"?: string | null,"sonata_id": string,"two_piece_effect_id": string
                  }
                  Update: {
                    "created_at"?: string,"five_piece_effect_id"?: string,"id"?: string,"patch_id"?: string,"provenance_id"?: string | null,"sonata_id"?: string,"two_piece_effect_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sonata_patch_data_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sonata_patch_data_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sonata_patch_data_sonata_id_fkey"
      columns: ["sonata_id"]
isOneToOne: false
      referencedRelation: "sonatas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sonata_patch_five_piece_fkey"
      columns: ["five_piece_effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    },{
      foreignKeyName: "sonata_patch_two_piece_fkey"
      columns: ["two_piece_effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"sonatas": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stage_area_effects": {
                  Row: {
                    "area_effect_id": string,"created_at": string,"effect_order": number,"id": string,"patch_id": string,"stage_id": string
                  }
                  Insert: {
                    "area_effect_id": string,"created_at"?: string,"effect_order"?: number,"id"?: string,"patch_id": string,"stage_id": string
                  }
                  Update: {
                    "area_effect_id"?: string,"created_at"?: string,"effect_order"?: number,"id"?: string,"patch_id"?: string,"stage_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_area_effects_effect_fkey"
      columns: ["area_effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "area_effects"
      referencedColumns: ["id","patch_id"]
    },{
      foreignKeyName: "stage_area_effects_stage_fkey"
      columns: ["stage_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_stages"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"toa_cycles": {
                  Row: {
                    "created_at": string,"cycle_name": string,"end_time": string,"id": string,"patch_id": string,"start_time": string
                  }
                  Insert: {
                    "created_at"?: string,"cycle_name": string,"end_time": string,"id"?: string,"patch_id": string,"start_time": string
                  }
                  Update: {
                    "created_at"?: string,"cycle_name"?: string,"end_time"?: string,"id"?: string,"patch_id"?: string,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "toa_cycles_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    }
                  ]
                },"toa_enemy_instances": {
                  Row: {
                    "created_at": string,"enemy_id": string,"id": string,"level": number,"patch_id": string,"spawn_order": number,"wave_id": string
                  }
                  Insert: {
                    "created_at"?: string,"enemy_id": string,"id"?: string,"level": number,"patch_id": string,"spawn_order"?: number,"wave_id": string
                  }
                  Update: {
                    "created_at"?: string,"enemy_id"?: string,"id"?: string,"level"?: number,"patch_id"?: string,"spawn_order"?: number,"wave_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "toa_enemy_instances_enemy_id_fkey"
      columns: ["enemy_id"]
isOneToOne: false
      referencedRelation: "enemies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "toa_enemy_instances_wave_fkey"
      columns: ["wave_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_waves"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"toa_stages": {
                  Row: {
                    "created_at": string,"id": string,"patch_id": string,"stage_index": number,"tower_id": string,"vigor_cost": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"patch_id": string,"stage_index": number,"tower_id": string,"vigor_cost": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patch_id"?: string,"stage_index"?: number,"tower_id"?: string,"vigor_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "toa_stages_tower_fkey"
      columns: ["tower_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_towers"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"toa_towers": {
                  Row: {
                    "created_at": string,"id": string,"patch_id": string,"tower_name": string,"tower_order": number,"zone_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"patch_id": string,"tower_name": string,"tower_order": number,"zone_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patch_id"?: string,"tower_name"?: string,"tower_order"?: number,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "toa_towers_zone_fkey"
      columns: ["zone_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_zones"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"toa_waves": {
                  Row: {
                    "created_at": string,"id": string,"patch_id": string,"stage_id": string,"wave_index": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"patch_id": string,"stage_id": string,"wave_index": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patch_id"?: string,"stage_id"?: string,"wave_index"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "toa_waves_stage_fkey"
      columns: ["stage_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_stages"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"toa_zones": {
                  Row: {
                    "created_at": string,"cycle_id": string,"id": string,"patch_id": string,"zone_type": string
                  }
                  Insert: {
                    "created_at"?: string,"cycle_id": string,"id"?: string,"patch_id": string,"zone_type": string
                  }
                  Update: {
                    "created_at"?: string,"cycle_id"?: string,"id"?: string,"patch_id"?: string,"zone_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "toa_zones_cycle_fkey"
      columns: ["cycle_id","patch_id"]
isOneToOne: false
      referencedRelation: "toa_cycles"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"user_resonator_loadouts": {
                  Row: {
                    "active_echo_id": string | null,"created_at": string,"id": string,"sonata_id": string | null,"updated_at": string,"user_id": string,"user_resonator_id": string,"weapon_instance_id": string | null
                  }
                  Insert: {
                    "active_echo_id"?: string | null,"created_at"?: string,"id"?: string,"sonata_id"?: string | null,"updated_at"?: string,"user_id": string,"user_resonator_id": string,"weapon_instance_id"?: string | null
                  }
                  Update: {
                    "active_echo_id"?: string | null,"created_at"?: string,"id"?: string,"sonata_id"?: string | null,"updated_at"?: string,"user_id"?: string,"user_resonator_id"?: string,"weapon_instance_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_resonator_loadouts_active_echo_id_fkey"
      columns: ["active_echo_id"]
isOneToOne: false
      referencedRelation: "echoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_resonator_loadouts_sonata_id_fkey"
      columns: ["sonata_id"]
isOneToOne: false
      referencedRelation: "sonatas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_resonator_loadouts_user_resonator_fkey"
      columns: ["user_resonator_id","user_id"]
isOneToOne: false
      referencedRelation: "user_resonators"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "user_resonator_loadouts_weapon_fkey"
      columns: ["weapon_instance_id","user_id"]
isOneToOne: false
      referencedRelation: "user_weapons"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"user_resonators": {
                  Row: {
                    "created_at": string,"forte_circuit_level": number,"id": string,"intro_skill_level": number,"level": number,"normal_attack_level": number,"resonance_liberation_level": number,"resonance_skill_level": number,"resonator_id": string,"updated_at": string,"user_id": string,"waveband": number
                  }
                  Insert: {
                    "created_at"?: string,"forte_circuit_level"?: number,"id"?: string,"intro_skill_level"?: number,"level"?: number,"normal_attack_level"?: number,"resonance_liberation_level"?: number,"resonance_skill_level"?: number,"resonator_id": string,"updated_at"?: string,"user_id": string,"waveband"?: number
                  }
                  Update: {
                    "created_at"?: string,"forte_circuit_level"?: number,"id"?: string,"intro_skill_level"?: number,"level"?: number,"normal_attack_level"?: number,"resonance_liberation_level"?: number,"resonance_skill_level"?: number,"resonator_id"?: string,"updated_at"?: string,"user_id"?: string,"waveband"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_resonators_resonator_id_fkey"
      columns: ["resonator_id"]
isOneToOne: false
      referencedRelation: "resonators"
      referencedColumns: ["id"]
    }
                  ]
                },"user_weapons": {
                  Row: {
                    "created_at": string,"id": string,"level": number,"refinement": number,"updated_at": string,"user_id": string,"weapon_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"level"?: number,"refinement"?: number,"updated_at"?: string,"user_id": string,"weapon_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"level"?: number,"refinement"?: number,"updated_at"?: string,"user_id"?: string,"weapon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_weapons_weapon_id_fkey"
      columns: ["weapon_id"]
isOneToOne: false
      referencedRelation: "weapons"
      referencedColumns: ["id"]
    }
                  ]
                },"weapon_patch_data": {
                  Row: {
                    "base_atk_lvl90": number,"created_at": string,"id": string,"passive_effect_id": string | null,"patch_id": string,"provenance_id": string | null,"sub_stat_type": string,"sub_stat_value_lvl90": number,"weapon_id": string
                  }
                  Insert: {
                    "base_atk_lvl90": number,"created_at"?: string,"id"?: string,"passive_effect_id"?: string | null,"patch_id": string,"provenance_id"?: string | null,"sub_stat_type": string,"sub_stat_value_lvl90": number,"weapon_id": string
                  }
                  Update: {
                    "base_atk_lvl90"?: number,"created_at"?: string,"id"?: string,"passive_effect_id"?: string | null,"patch_id"?: string,"provenance_id"?: string | null,"sub_stat_type"?: string,"sub_stat_value_lvl90"?: number,"weapon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weapon_patch_data_patch_id_fkey"
      columns: ["patch_id"]
isOneToOne: false
      referencedRelation: "patches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weapon_patch_data_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weapon_patch_data_weapon_id_fkey"
      columns: ["weapon_id"]
isOneToOne: false
      referencedRelation: "weapons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weapon_patch_effect_fkey"
      columns: ["passive_effect_id","patch_id"]
isOneToOne: false
      referencedRelation: "gameplay_effects"
      referencedColumns: ["id","patch_id"]
    }
                  ]
                },"weapons": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"rarity": number,"weapon_type": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"rarity": number,"weapon_type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"rarity"?: number,"weapon_type"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
