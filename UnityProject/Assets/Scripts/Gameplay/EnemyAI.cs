using UnityEngine;
namespace SlimeAscendant {
 public sealed class EnemyAI:MonoBehaviour {
  [SerializeField] private float maxHealth=35,moveSpeed=2.2f;private float health,attackTimer;private Transform target;public bool IsDead{get;private set;}
  private void Start(){health=maxHealth;}
  private void Update(){if(IsDead)return;if(target==null){var p=FindObjectOfType<PlayerMotor>();if(p==null)return;target=p.transform;}Vector3 d=target.position-transform.position;d.y=0;if(d.sqrMagnitude>3.24f){Vector3 dir=d.normalized;transform.position+=dir*moveSpeed*Time.deltaTime;if(dir.sqrMagnitude>.01f)transform.rotation=Quaternion.LookRotation(dir);}else{attackTimer-=Time.deltaTime;if(attackTimer<=0){var p=target.GetComponent<PlayerMotor>();if(p!=null)p.TakeDamage(7);attackTimer=1.2f;}}}
  public void TakeDamage(float amount){if(IsDead)return;health-=Mathf.Max(0,amount);transform.localScale*=.985f;if(health<=0){IsDead=true;Destroy(gameObject);}}
 }
}