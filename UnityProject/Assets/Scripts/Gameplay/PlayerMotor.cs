using UnityEngine;
namespace SlimeAscendant {
 [RequireComponent(typeof(CharacterController))]
 public sealed class PlayerMotor:MonoBehaviour {
  [SerializeField] private float attackRange=3.2f;private CharacterController controller;private ClassStats stats;private float health,attackTimer;private PlayerClass currentClass;private int powerLevel=1;
  public float Health=>health;public float MaxHealth=>stats.MaxHealth;public PlayerClass CurrentClass=>currentClass;
  private void Awake(){controller=GetComponent<CharacterController>();controller.height=2.3f;controller.radius=.48f;controller.center=new Vector3(0,1.15f,0);}
  private void Start(){SetClass(PlayerClass.Knight);}
  public void SetClass(PlayerClass c){currentClass=c;stats=ClassCatalog.Get(c);health=stats.MaxHealth;if(c==PlayerClass.Knight&&GetComponent<OrbitingOrbs>()==null)gameObject.AddComponent<OrbitingOrbs>();if(c==PlayerClass.Necromancer&&GetComponent<NecromancerPower>()==null)gameObject.AddComponent<NecromancerPower>();}
  public void UpgradePower(){powerLevel=Mathf.Min(5,powerLevel+1);}
  private void Update(){Vector2 input=MobileInput.Move;if(input.sqrMagnitude<.01f)input=new Vector2(Input.GetAxisRaw("Horizontal"),Input.GetAxisRaw("Vertical"));Vector3 move=new Vector3(input.x,0,input.y);if(move.sqrMagnitude>1)move.Normalize();controller.SimpleMove(move*stats.MoveSpeed);if(move.sqrMagnitude>.01f)transform.rotation=Quaternion.Slerp(transform.rotation,Quaternion.LookRotation(move),Time.deltaTime*12);attackTimer-=Time.deltaTime;if(attackTimer<=0)AutoAttack();}
  private void AutoAttack(){EnemyAI target=null;float best=attackRange;foreach(var e in FindObjectsOfType<EnemyAI>()){if(e==null||e.IsDead)continue;float d=Vector3.Distance(transform.position,e.transform.position);if(d<best){best=d;target=e;}}if(target==null)return;target.TakeDamage(12*stats.Damage*(1+(powerLevel-1)*.18f));attackTimer=stats.AttackCooldown;}
  public void TakeDamage(float amount){health=Mathf.Max(0,health-amount);}public void Heal(float amount){health=Mathf.Min(stats.MaxHealth,health+amount);}
 }
}