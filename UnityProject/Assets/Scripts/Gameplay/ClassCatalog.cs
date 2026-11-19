namespace SlimeAscendant {
 public enum PlayerClass { Starter, Mage, Knight, Necromancer, Healer, Archer }
 public struct ClassStats { public float MaxHealth,MoveSpeed,Damage,AttackCooldown;public int Price;public string SpecialPower; }
 public static class ClassCatalog {
  public static ClassStats Get(PlayerClass c){switch(c){
   case PlayerClass.Mage:return new ClassStats{MaxHealth=70,MoveSpeed=4.8f,Damage=1.15f,AttackCooldown=.85f,Price=450,SpecialPower="Arcane lightning"};
   case PlayerClass.Knight:return new ClassStats{MaxHealth=150,MoveSpeed=4.2f,Damage=1.25f,AttackCooldown=.75f,Price=250,SpecialPower="Orbiting energy orbs"};
   case PlayerClass.Necromancer:return new ClassStats{MaxHealth=85,MoveSpeed=4.8f,Damage=1.1f,AttackCooldown=.9f,Price=600,SpecialPower="Skeleton summons"};
   case PlayerClass.Healer:return new ClassStats{MaxHealth=110,MoveSpeed=4.8f,Damage=.8f,AttackCooldown=1f,Price=500,SpecialPower="Healing aura"};
   case PlayerClass.Archer:return new ClassStats{MaxHealth=80,MoveSpeed=5.2f,Damage=1.05f,AttackCooldown=.65f,Price=350,SpecialPower="Rapid arrows"};
   default:return new ClassStats{MaxHealth=100,MoveSpeed=4.8f,Damage=1f,AttackCooldown=.9f,Price=0,SpecialPower="Basic attack"};
  }}
 }
}